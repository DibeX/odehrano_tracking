// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  userId: string;
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
      .select("role")
      .eq("auth_user_id", user.id)
      .single();

    if (roleError || !userData || userData.role !== "admin") {
      throw new Error("Not authorized - admin role required");
    }

    // Parse the request body
    const { userId }: DeleteUserRequest = await req.json();

    if (!userId) {
      throw new Error("User ID is required");
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

    // Verify the user to be deleted exists
    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from("users")
      .select("id, nickname, email, auth_user_id, is_placeholder")
      .eq("id", userId)
      .single();

    if (targetError || !targetUser) {
      throw new Error("User not found");
    }

    // Prevent self-deletion (check both user.id and auth_user_id)
    if (targetUser.auth_user_id === user.id) {
      throw new Error("Cannot delete your own account");
    }

    // For placeholder users (no auth account), just delete from users table
    if (targetUser.is_placeholder || !targetUser.auth_user_id) {
      const { error: deleteError } = await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", userId);

      if (deleteError) {
        throw new Error(`Failed to delete user: ${deleteError.message}`);
      }
    } else {
      // For regular users with auth accounts, delete from auth.users
      // This will cascade to public.users due to ON DELETE SET NULL
      // So we need to also delete from users table
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
        targetUser.auth_user_id
      );

      if (authDeleteError) {
        throw new Error(`Failed to delete auth user: ${authDeleteError.message}`);
      }

      // The CASCADE should handle the users table deletion, but let's be explicit
      const { error: userDeleteError } = await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", userId);

      if (userDeleteError) {
        // This might fail if cascade already deleted it, which is fine
        console.log("User table delete error (may be expected):", userDeleteError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${targetUser.nickname} has been deleted`,
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
