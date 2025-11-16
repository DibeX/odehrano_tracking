import { createFileRoute, Link } from "@tanstack/react-router";
import { Trans } from "@lingui/react/macro";
import { requireAuth } from "@/lib/auth-helpers";
import { useAuthContext } from "@/contexts/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  beforeLoad: async () => {
    await requireAuth();
  },
});

function DashboardPage() {
  const { user, isAdmin, isModerator } = useAuthContext();

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          <Trans>Welcome back, {user?.nickname}!</Trans>
        </h1>
        <p className="text-muted-foreground">
          <Trans>Manage your tabletop gaming sessions and rankings</Trans>
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>My Games</Trans>
            </CardTitle>
            <CardDescription>
              <Trans>View and manage your played games</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/games">
              <Button className="w-full">
                <Trans>View Games</Trans>
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>My Rankings</Trans>
            </CardTitle>
            <CardDescription>
              <Trans>Rank your favorite games by year</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/rankings">
              <Button className="w-full">
                <Trans>Manage Rankings</Trans>
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Results</Trans>
            </CardTitle>
            <CardDescription>
              <Trans>View community game rankings</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/results" search={{ year: undefined }}>
              <Button className="w-full">
                <Trans>View Results</Trans>
              </Button>
            </Link>
          </CardContent>
        </Card>

        {(isAdmin || isModerator) && (
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Add Played Game</Trans>
              </CardTitle>
              <CardDescription>
                <Trans>Record a new game session</Trans>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/games/new">
                <Button className="w-full" variant="secondary">
                  <Trans>Add Game</Trans>
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>User Management</Trans>
              </CardTitle>
              <CardDescription>
                <Trans>Manage users and invitations</Trans>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/admin/users">
                <Button className="w-full" variant="secondary">
                  <Trans>Manage Users</Trans>
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>My Profile</Trans>
            </CardTitle>
            <CardDescription>
              <Trans>Update your profile information</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/profile">
              <Button className="w-full" variant="outline">
                <Trans>Edit Profile</Trans>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
