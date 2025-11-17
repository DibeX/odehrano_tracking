// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  role: "player" | "moderator" | "admin";
  resend?: boolean;
  token?: string;
  placeholderUserId?: string; // For activating placeholder users
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@odehrano.cz";

async function sendInviteEmail(
  email: string,
  inviteLink: string,
  role: string
): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject: "Odehráno tracking - You've been invited!",
      html: `
        <h2>You've been invited!</h2>
        <p>You've been invited to join Odehráno as a <strong>${role}</strong>.</p>
        <p>Click the link below to set up your account:</p>
        <p><a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Accept Invitation</a></p>
        <p>Or copy this link: ${inviteLink}</p>
        <p>This invitation expires in 14 days.</p>
        <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      `,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the authorization header to verify the user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Create a Supabase client with the user's JWT to verify they're admin
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify the user is authenticated and is an admin
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    const { data: userData, error: roleError } = await supabaseClient
      .from("users")
      .select("id, role")
      .eq("auth_user_id", user.id)
      .single();

    if (roleError || !userData || userData.role !== "admin") {
      throw new Error("Not authorized - admin role required");
    }

    // Parse the request body
    const {
      email,
      role,
      resend,
      token: existingToken,
      placeholderUserId,
    }: InviteRequest = await req.json();

    if (!resend && (!email || !role)) {
      throw new Error("Email and role are required");
    }

    if (role && !["player", "moderator", "admin"].includes(role)) {
      throw new Error("Invalid role");
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    let token: string;
    let inviteEmail: string;
    let inviteRole: string;

    if (resend && existingToken) {
      // Resend existing invitation
      const { data: invitation, error: fetchError } = await supabaseAdmin
        .from("user_invitations")
        .select("*")
        .eq("token", existingToken)
        .is("used_at", null)
        .single();

      if (fetchError || !invitation) {
        throw new Error("Invitation not found or already used");
      }

      token = invitation.token;
      inviteEmail = invitation.email;
      inviteRole = invitation.role;

      // Optionally extend expiration on resend
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 14);

      await supabaseAdmin
        .from("user_invitations")
        .update({ expires_at: newExpiresAt.toISOString() })
        .eq("token", token);
    } else {
      // Create new invitation
      token = crypto.randomUUID();
      inviteEmail = email;
      inviteRole = role;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);

      // If this is for a placeholder user, verify the user exists and is a placeholder
      if (placeholderUserId) {
        const { data: placeholderUser, error: placeholderError } = await supabaseAdmin
          .from("users")
          .select("id, is_placeholder")
          .eq("id", placeholderUserId)
          .single();

        if (placeholderError || !placeholderUser) {
          throw new Error("Placeholder user not found");
        }

        if (!placeholderUser.is_placeholder) {
          throw new Error("User is not a placeholder user");
        }
      }

      const { error: invitationError } = await supabaseAdmin
        .from("user_invitations")
        .insert({
          email: inviteEmail,
          token,
          role: inviteRole,
          created_by: userData.id, // Use user profile ID, not auth ID
          expires_at: expiresAt.toISOString(),
          placeholder_user_id: placeholderUserId || null,
        });

      if (invitationError) {
        throw new Error(
          `Failed to create invitation record: ${invitationError.message}`
        );
      }
    }

    // Send invitation email via Resend
    const inviteLink = `${APP_URL}/invite/${token}`;
    await sendInviteEmail(inviteEmail, inviteLink, inviteRole);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation email sent to ${inviteEmail}`,
        token: token,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
