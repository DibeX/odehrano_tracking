import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
import { useAuth } from "@/hooks/use-auth";
import { LanguageSelector } from "@/components/ui/language-selector";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { _ } = useLingui();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

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

        // Wait for auth state to update before navigating
        if (data?.session) {
          // Small delay to ensure auth state is propagated
          await new Promise((resolve) => setTimeout(resolve, 100));
          navigate({ to: "/dashboard" });
        } else {
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
