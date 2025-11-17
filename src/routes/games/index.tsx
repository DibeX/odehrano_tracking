import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { requireAuth } from "@/lib/auth-helpers";
import { useAuthContext } from "@/contexts/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatDate } from "@/lib/utils";
import type { PlayedGameWithDetails } from "@/types";
import { Plus, Library, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/games/")({
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
        .from("played_games")
        .select(
          `
          *,
          board_game:board_games(*),
          players:played_game_players(
            *,
            user:users(*)
          ),
          comments:played_game_comments(
            *,
            user:users(*)
          )
        `
        )
        .order("played_at", { ascending: false });

      if (error) throw error;

      // Fetch creators separately
      if (data && data.length > 0) {
        const creatorIds = [...new Set(data.map((g) => g.created_by))];
        const { data: creators } = await supabase
          .from("users")
          .select("*")
          .in("id", creatorIds);

        const creatorsMap = new Map(creators?.map((c) => [c.id, c]) || []);

        data.forEach((game: any) => {
          game.creator = creatorsMap.get(game.created_by) || null;
        });
      }

      setGames(data as any);
    } catch (error: any) {
      toast({
        title: _(t`Error loading games`),
        description: error.message,
        variant: "destructive",
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

          <div className="flex gap-2">
            <Link to="/games/library">
              <Button variant="outline">
                <Library className="w-4 h-4 mr-2" />
                <Trans>Game Library</Trans>
              </Button>
            </Link>
            {(isAdmin || isModerator) && (
              <Link to="/games/sessions/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  <Trans>Record Session</Trans>
                </Button>
              </Link>
            )}
          </div>
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
              <div className="space-y-4 text-center">
                <p className="text-muted-foreground">
                  <Trans>No play sessions recorded yet</Trans>
                </p>
                {(isAdmin || isModerator) && (
                  <Link to="/games/sessions/new">
                    <Button>
                      <Trans>Record First Session</Trans>
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {games.map((game) => (
              <Card key={game.id} className="flex flex-col overflow-hidden">
                {game.board_game.image_url && (
                  <div className="flex items-center justify-center h-48 overflow-hidden bg-muted">
                    <img
                      src={game.board_game.image_url}
                      alt={game.custom_name || game.board_game.name}
                      className="object-contain max-w-full max-h-full"
                    />
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="line-clamp-2">
                        {game.custom_name || game.board_game.name}
                      </CardTitle>
                      <CardDescription>
                        <Trans>Played on {formatDate(game.played_at)}</Trans>
                      </CardDescription>
                    </div>
                    {game.board_game.bgg_id && (
                      <a
                        href={`https://boardgamegeek.com/boardgame/${game.board_game.bgg_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          BGG
                        </Button>
                      </a>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 space-y-2">
                  {game.players && game.players.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-medium">
                        <Trans>Players:</Trans>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {game.players.map((player) => (
                          <div
                            key={player.id}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                              player.is_winner
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground"
                            }`}
                          >
                            <UserAvatar
                              nickname={player.user.nickname}
                              avatarUrl={player.user.avatar_url}
                              size="xs"
                              showFallback={false}
                            />
                            {player.user.nickname}
                            {player.is_winner && " 👑"}
                            {player.score !== null && ` (${player.score})`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {game.note && (
                    <div>
                      <p className="mb-1 text-sm font-medium">
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

                  <div className="pt-2 mt-auto">
                    <Link to="/games/$gameId" params={{ gameId: game.id }}>
                      <Button variant="outline" className="w-full">
                        <Trans>View Details</Trans>
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
