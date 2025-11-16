import { Link, useRouter } from "@tanstack/react-router";
import { Trans } from "@lingui/react/macro";
import { useAuthContext } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSelector } from "@/components/ui/language-selector";
import logoBlack from "@/assets/logos/played_logo_black.png";
import logoWhite from "@/assets/logos/played_logo_white.png";

export function Header() {
  const { user, signOut, isAdmin, isModerator } = useAuthContext();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    window.location.href = "/login";
  }

  if (!user) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="container flex items-center justify-between h-16 px-4 mx-auto">
        <div className="flex items-center gap-4">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              router.navigate({ to: "/" });
            }}
            className="flex items-center"
          >
            <img src={logoBlack} alt="Played" className="h-12 dark:hidden" />
            <img
              src={logoWhite}
              alt="Played"
              className="hidden h-12 dark:block"
            />
          </a>

          <nav className="items-center hidden gap-4 md:flex">
            <Link
              to="/dashboard"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              <Trans>Dashboard</Trans>
            </Link>
            <Link
              to="/games"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              <Trans>Games</Trans>
            </Link>
            <Link
              to="/rankings"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              <Trans>Rankings</Trans>
            </Link>
            <Link
              to="/results"
              search={{ year: undefined }}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              <Trans>Results</Trans>
            </Link>
            {/* {(isAdmin || isModerator) && (
              <Link
                to="/games/new"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                <Trans>Add Game</Trans>
              </Link>
            )} */}
            {isAdmin && (
              <Link
                to="/admin/users"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                <Trans>Users</Trans>
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <LanguageSelector />
          <ThemeToggle />
          <Link to="/profile" className="flex items-center gap-2">
            <UserAvatar
              nickname={user.nickname}
              avatarUrl={user.avatar_url}
              size="md"
            />
            <span className="hidden text-sm font-medium md:inline-block">
              {user.nickname}
            </span>
          </Link>
          <Button onClick={handleSignOut} variant="ghost" size="sm">
            <Trans>Sign Out</Trans>
          </Button>
        </div>
      </div>
    </header>
  );
}
