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
import { useAuthContext } from "@/contexts/auth-context";
import { LanguageSelector } from "@/components/ui/language-selector";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: loginSearchSchema,
});

function LoginPage() {
  const { _ } = useLingui();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const { signIn, resetPassword, user, loading: authLoading } = useAuthContext();
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();

  // Redirect to intended page (or dashboard) if already logged in
  useEffect(() => {
    if (user) {
      navigate({ to: redirectTo || "/dashboard" });
    }
  }, [user, navigate, redirectTo]);

  // Show loading spinner while checking auth state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (resetMode) {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setResetSuccess(true);
      } else {
        const { data, error } = await signIn(email, password);

        if (error) {
          throw error;
        }

        // Navigation will happen automatically via useEffect when user state updates
        if (!data?.session) {
          console.warn("🟡 No session in response");
        }
      }
    } catch (err: any) {
      console.error("🔴 Login error:", err);
      setError(err.message || _(t`An error occurred`));
    } finally {
      setLoading(false);
    }
  }

  if (resetSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>
              <Trans>Check your email</Trans>
            </CardTitle>
            <CardDescription>
              <Trans>
                We've sent you a password reset link. Please check your email
                and follow the instructions.
              </Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => {
                setResetMode(false);
                setResetSuccess(false);
                setEmail("");
              }}
              variant="outline"
              className="w-full"
            >
              <Trans>Back to login</Trans>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex justify-between">
            <div className="flex flex-col gap-1">
              {resetMode ? <Trans>Reset Password</Trans> : <Trans>Login</Trans>}
              <CardDescription>
                {resetMode ? (
                  <Trans>
                    Enter your email to receive a password reset link
                  </Trans>
                ) : (
                  <Trans>Enter your credentials to access your account</Trans>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <LanguageSelector />
              <ThemeToggle />
            </div>
          </CardTitle>
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
                placeholder={_(t`you@example.com`)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {!resetMode && (
              <div className="space-y-2">
                <Label htmlFor="password">
                  <Trans>Password</Trans>
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            )}

            {error && (
              <div className="p-3 text-sm rounded-md bg-destructive/15 text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Trans>Please wait...</Trans>
              ) : resetMode ? (
                <Trans>Send reset link</Trans>
              ) : (
                <Trans>Sign in</Trans>
              )}
            </Button>

            <Button
              type="button"
              variant="link"
              className="w-full"
              onClick={() => {
                setResetMode(!resetMode);
                setError("");
              }}
              disabled={loading}
            >
              {resetMode ? (
                <Trans>Back to login</Trans>
              ) : (
                <Trans>Forgot password?</Trans>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
