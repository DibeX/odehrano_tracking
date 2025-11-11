import { Link } from '@tanstack/react-router';
import { Trans } from '@lingui/macro';
import { useAuthContext } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function Header() {
  const { user, signOut, isAdmin, isModerator } = useAuthContext();

  async function handleSignOut() {
    await signOut();
    window.location.href = '/login';
  }

  if (!user) {
    return null;
  }

  const initials = user.nickname
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="text-xl font-bold">
            <Trans>Tabletop Tracker</Trans>
          </Link>

          <nav className="hidden md:flex items-center gap-4">
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
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              <Trans>Results</Trans>
            </Link>
            {(isAdmin || isModerator) && (
              <Link
                to="/games/new"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                <Trans>Add Game</Trans>
              </Link>
            )}
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
          <Link to="/profile" className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.nickname} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden md:inline-block text-sm font-medium">{user.nickname}</span>
          </Link>
          <Button onClick={handleSignOut} variant="ghost" size="sm">
            <Trans>Sign Out</Trans>
          </Button>
        </div>
      </div>
    </header>
  );
}
