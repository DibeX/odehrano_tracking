import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import type { UserInvitation } from "@/types";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { _ } = useLingui();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<UserInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadInvitation();
  }, [token]);

  async function loadInvitation() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_invitations")
        .select("*")
        .eq("token", token)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          setError(_(t`This invitation link is invalid or has expired`));
        } else {
          throw error;
        }
        return;
      }

      setInvitation(data);
      // Pre-fill nickname from email
      const emailPrefix = data.email.split("@")[0];
      setNickname(emailPrefix);
    } catch (error: any) {
      setError(error.message || _(t`Failed to load invitation`));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(_(t`Passwords do not match`));
      return;
    }

    if (password.length < 8) {
      setError(_(t`Password must be at least 8 characters long`));
      return;
    }

    if (!nickname.trim()) {
      setError(_(t`Nickname is required`));
      return;
    }

    setSubmitting(true);
    try {
      if (!invitation) throw new Error("No invitation found");

      // Create the user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp(
        {
          email: invitation.email,
          password,
          options: {
            data: {
              nickname,
              role: invitation.role,
            },
          },
        }
      );

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("Failed to create user");

      // Update the user's nickname in the users table
      const { error: updateError } = await supabase
        .from("users")
        .update({ nickname })
        .eq("id", authData.user.id);

      if (updateError) throw updateError;

      // Mark invitation as used
      const { error: invitationError } = await supabase
        .from("user_invitations")
        .update({ used_at: new Date().toISOString() })
        .eq("id", invitation.id);

      if (invitationError) throw invitationError;

      // Redirect to dashboard
      navigate({ to: "/dashboard" });
    } catch (error: any) {
      setError(error.message || _(t`Failed to create account`));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              <Trans>Loading invitation...</Trans>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>
              <Trans>Invalid Invitation</Trans>
            </CardTitle>
            <CardDescription className="text-destructive">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate({ to: "/login" })}
              className="w-full"
            >
              <Trans>Go to Login</Trans>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <Trans>Set Up Your Account</Trans>
          </CardTitle>
          <CardDescription>
            <Trans>You've been invited to join as a {invitation?.role}</Trans>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                <Trans>Email</Trans>
              </Label>
              <Input
                id="email"
                type="email"
                value={invitation?.email || ""}
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">
                <Trans>Nickname</Trans>
              </Label>
              <Input
                id="nickname"
                type="text"
                placeholder={_(t`Enter your nickname`)}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">
                <Trans>This name will be visible to other users</Trans>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                <Trans>Password</Trans>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={_(t`Choose a password`)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                <Trans>Confirm Password</Trans>
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={_(t`Confirm your password`)}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={submitting}
                minLength={8}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Trans>Creating account...</Trans>
              ) : (
                <Trans>Create Account</Trans>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
