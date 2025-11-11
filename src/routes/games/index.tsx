import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { requireAuth } from '@/lib/auth-helpers';
import { useAuthContext } from '@/contexts/auth-context';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import type { PlayedGameWithDetails } from '@/types';

export const Route = createFileRoute('/games/')({
  component: GamesPage,
  beforeLoad: async () => {
    await requireAuth();
  },
});

function GamesPage() {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { isAdmin, isModerator } = useAuthContext();
  const [games, setGames] = useState<PlayedGameWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGames();
  }, []);

  async function loadGames() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('played_games')
        .select(`
          *,
          board_game:board_games(*),
          players:played_game_players(
            *,
            user:users(*)
          ),
          comments:played_game_comments(
            *,
            user:users(*)
          ),
          creator:created_by(*)
        `)
        .order('played_at', { ascending: false });

      if (error) throw error;

      setGames(data as any);
    } catch (error: any) {
      toast({
        title: _(t`Error loading games`),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              <Trans>Played Games</Trans>
            </h1>
            <p className="text-muted-foreground">
              <Trans>Browse all game sessions</Trans>
            </p>
          </div>

          {(isAdmin || isModerator) && (
            <Link to="/games/new">
              <Button>
                <Trans>Add Game Session</Trans>
              </Button>
            </Link>
          )}
        </div>

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                <Trans>Loading games...</Trans>
              </p>
            </CardContent>
          </Card>
        ) : games.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  <Trans>No games recorded yet</Trans>
                </p>
                {(isAdmin || isModerator) && (
                  <Link to="/games/new">
                    <Button>
                      <Trans>Add First Game</Trans>
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <Card key={game.id} className="overflow-hidden">
                {game.board_game.image_url && (
                  <div className="aspect-video overflow-hidden bg-muted">
                    <img
                      src={game.board_game.image_url}
                      alt={game.custom_name || game.board_game.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="line-clamp-2">
                    {game.custom_name || game.board_game.name}
                  </CardTitle>
                  <CardDescription>
                    <Trans>Played on {formatDate(game.played_at)}</Trans>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {game.players && game.players.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        <Trans>Players:</Trans>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {game.players.map((player) => (
                          <div
                            key={player.id}
                            className={`text-xs px-2 py-1 rounded-full ${
                              player.is_winner
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground'
                            }`}
                          >
                            {player.user.nickname}
                            {player.is_winner && ' 👑'}
                            {player.score !== null && ` (${player.score})`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {game.note && (
                    <div>
                      <p className="text-sm font-medium mb-1">
                        <Trans>Note:</Trans>
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {game.note}
                      </p>
                    </div>
                  )}

                  {game.comments && game.comments.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      <Trans>{game.comments.length} comment(s)</Trans>
                    </p>
                  )}

                  <Link to="/games/$gameId" params={{ gameId: game.id }}>
                    <Button variant="outline" className="w-full">
                      <Trans>View Details</Trans>
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
