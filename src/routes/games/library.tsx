import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { requireAuth } from "@/lib/auth-helpers";
import { useAuthContext } from "@/contexts/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { BoardGame } from "@/types";
import {
  getBoardGameTypeLabel,
  type BoardGameType,
} from "@/constants/board-game-types";
import { Plus, Search, Edit, ArrowLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/games/library")({
  component: GamesLibraryPage,
  beforeLoad: async () => {
    await requireAuth();
  },
});

function GamesLibraryPage() {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { isAdmin, isModerator } = useAuthContext();
  const router = useRouter();
  const [games, setGames] = useState<BoardGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState<BoardGame | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadGames();
  }, []);

  function handleBack() {
    if (router.history.length <= 1) {
      router.navigate({ to: "/" });
    } else {
      router.history.back();
    }
  }

  async function loadGames() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("board_games")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      setGames(data || []);
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

  const filteredGames = games.filter((game) => {
    const query = searchQuery.toLowerCase();
    return (
      game.name.toLowerCase().includes(query) ||
      game.alternate_names?.some((name) =>
        name.toLowerCase().includes(query)
      ) ||
      game.publishers?.some((pub) => pub.toLowerCase().includes(query)) ||
      game.categories?.some((cat) => cat.toLowerCase().includes(query))
    );
  });

  async function handleDeleteGame() {
    if (!gameToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("board_games")
        .delete()
        .eq("id", gameToDelete.id);

      if (error) throw error;

      toast({
        title: _(t`Game deleted`),
        description: _(t`The board game has been permanently deleted`),
      });

      setDeleteDialogOpen(false);
      setGameToDelete(null);
      loadGames();
    } catch (error: any) {
      toast({
        title: _(t`Error deleting game`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex gap-4 text-3xl font-bold">
              <Trans>Game Library</Trans>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="self-center"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                <Trans>Back</Trans>
              </Button>
            </h1>
            <p className="text-muted-foreground">
              <Trans>
                All board games in the database ({games.length} games)
              </Trans>
            </p>
          </div>

          {(isAdmin || isModerator) && (
            <Link to="/games/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                <Trans>Add Game</Trans>
              </Button>
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute w-4 h-4 left-3 top-3 text-muted-foreground" />
          <Input
            placeholder={_(t`Search games by name, publisher, or category...`)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                <Trans>Loading games...</Trans>
              </p>
            </CardContent>
          </Card>
        ) : filteredGames.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4 text-center">
                {searchQuery ? (
                  <p className="text-muted-foreground">
                    <Trans>No games found matching "{searchQuery}"</Trans>
                  </p>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      <Trans>No games in the library yet</Trans>
                    </p>
                    {(isAdmin || isModerator) && (
                      <Link to="/games/new">
                        <Button>
                          <Trans>Add First Game</Trans>
                        </Button>
                      </Link>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredGames.map((game) => (
              <Card key={game.id} className="overflow-hidden flex flex-col">
                {game.image_url && (
                  <div className="flex items-center justify-center overflow-hidden h-48 bg-muted">
                    <img
                      src={game.image_url}
                      alt={game.name}
                      className="object-contain max-w-full max-h-full"
                    />
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="line-clamp-2">{game.name}</CardTitle>
                  <CardDescription>
                    {game.year_published && (
                      <span>
                        <Trans>Year: {game.year_published}</Trans>
                      </span>
                    )}
                    {game.bgg_id && (
                      <>
                        {game.year_published && " • "}
                        <a
                          href={`https://boardgamegeek.com/boardgame/${game.bgg_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          BGG #{game.bgg_id}
                        </a>
                      </>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col">
                  {game.alternate_names && game.alternate_names.length > 0 && (
                    <div>
                      <p className="mb-1 text-sm font-medium">
                        <Trans>Also known as:</Trans>
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {game.alternate_names.join(", ")}
                      </p>
                    </div>
                  )}

                  {game.publishers && game.publishers.length > 0 && (
                    <div>
                      <p className="mb-1 text-sm font-medium">
                        <Trans>Publishers:</Trans>
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {game.publishers.join(", ")}
                      </p>
                    </div>
                  )}

                  {game.game_type && (
                    <div>
                      <p className="mb-1 text-sm font-medium">
                        <Trans>Game Type:</Trans>
                      </p>
                      <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                        {getBoardGameTypeLabel(
                          game.game_type as BoardGameType,
                          _
                        )}
                      </span>
                    </div>
                  )}

                  {game.categories && game.categories.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-medium">
                        <Trans>Categories:</Trans>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {game.categories.slice(0, 5).map((category) => (
                          <span
                            key={category}
                            className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground"
                          >
                            {category}
                          </span>
                        ))}
                        {game.categories.length > 5 && (
                          <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                            +{game.categories.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {(isAdmin || isModerator) && (
                    <div className="flex flex-col gap-2 mt-auto pt-2">
                      <div className="flex gap-2">
                        <Link
                          to="/games/edit/$gameId"
                          params={{ gameId: game.id }}
                          className="flex-1"
                        >
                          <Button variant="outline" className="w-full">
                            <Edit className="w-4 h-4 mr-2" />
                            <Trans>Edit</Trans>
                          </Button>
                        </Link>
                        <Link
                          to="/games/sessions/new"
                          search={{ gameId: game.id }}
                          className="flex-1"
                        >
                          <Button variant="outline" className="w-full">
                            <Plus className="w-4 h-4 mr-2" />
                            <Trans>Record Session</Trans>
                          </Button>
                        </Link>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setGameToDelete(game);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        <Trans>Delete Game</Trans>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete confirmation dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <Trans>Delete Board Game</Trans>
              </DialogTitle>
              <DialogDescription>
                <Trans>
                  Are you sure you want to permanently delete "{gameToDelete?.name}"? This will also delete all play sessions associated with this game. This action cannot be undone.
                </Trans>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setGameToDelete(null);
                }}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteGame}
                disabled={deleting}
              >
                {deleting ? (
                  <Trans>Deleting...</Trans>
                ) : (
                  <Trans>Delete Permanently</Trans>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
