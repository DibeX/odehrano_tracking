import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { requireAuth } from "@/lib/auth-helpers";
import { useAuthContext } from "@/contexts/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { PlayedGameWithDetails } from "@/types";
import { ExternalLink, ArrowLeft, Trash2, Edit } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/games/$gameId")({
  component: GameDetailsPage,
  beforeLoad: async () => {
    await requireAuth();
  },
});

function GameDetailsPage() {
  const { gameId } = Route.useParams();
  const { user, isAdmin, isModerator } = useAuthContext();
  const { _ } = useLingui();
  const { toast } = useToast();
  const router = useRouter();
  const [game, setGame] = useState<PlayedGameWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleBack() {
    if (router.history.length <= 1) {
      router.navigate({ to: "/" });
    } else {
      router.history.back();
    }
  }

  useEffect(() => {
    loadGame();
  }, [gameId]);

  async function loadGame() {
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
        .eq("id", gameId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setGame(null);
        setLoading(false);
        return;
      }

      // Fetch creator separately
      if (data) {
        const { data: creatorData } = await supabase
          .from("users")
          .select("*")
          .eq("id", data.created_by)
          .single();

        (data as any).creator = creatorData;
      }

      setGame(data as any);
    } catch (error: any) {
      toast({
        title: _(t`Error loading game`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("played_game_comments").insert({
        played_game_id: gameId,
        user_id: user.id,
        comment: newComment,
      });

      if (error) throw error;

      toast({
        title: _(t`Comment added`),
        description: _(t`Your comment has been added successfully`),
      });

      setNewComment("");
      loadGame();
    } catch (error: any) {
      toast({
        title: _(t`Error adding comment`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteGame() {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("played_games")
        .delete()
        .eq("id", gameId);

      if (error) throw error;

      toast({
        title: _(t`Game session deleted`),
        description: _(t`The game session has been permanently deleted`),
      });

      setDeleteDialogOpen(false);
      router.navigate({ to: "/games" });
    } catch (error: any) {
      toast({
        title: _(t`Error deleting game session`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            <Trans>Back</Trans>
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                <Trans>Loading...</Trans>
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!game) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            <Trans>Back</Trans>
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                <Trans>Game not found</Trans>
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          <Trans>Back</Trans>
        </Button>
        <Card>
          {game.board_game.image_url && (
            <div className="overflow-hidden aspect-video rounded-t-xl bg-muted">
              <img
                src={game.board_game.image_url}
                alt={game.custom_name || game.board_game.name}
                className="object-cover w-full h-full"
              />
            </div>
          )}
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-3xl">
                {game.custom_name || game.board_game.name}
              </CardTitle>
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
            {game.custom_name && (
              <p className="text-sm text-muted-foreground">
                <Trans>Original: {game.board_game.name}</Trans>
              </p>
            )}
            <CardDescription>
              <Trans>Played on {formatDate(game.played_at)}</Trans>
              {" • "}
              <Trans>Added by {game.creator?.nickname}</Trans>
            </CardDescription>
            {(isAdmin || isModerator) && (
              <div className="flex gap-2 pt-2">
                <Link to="/games/sessions/edit/$sessionId" params={{ sessionId: gameId }}>
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4 mr-2" />
                    <Trans>Edit Session</Trans>
                  </Button>
                </Link>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  <Trans>Delete Session</Trans>
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {game.board_game.year_published && (
              <div>
                <p className="mb-1 text-sm font-medium">
                  <Trans>Year Published:</Trans>
                </p>
                <p>{game.board_game.year_published}</p>
              </div>
            )}

            {game.board_game.categories.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">
                  <Trans>Categories:</Trans>
                </p>
                <div className="flex flex-wrap gap-2">
                  {game.board_game.categories.map((category) => (
                    <span
                      key={category}
                      className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {game.note && (
              <div>
                <p className="mb-1 text-sm font-medium">
                  <Trans>Notes:</Trans>
                </p>
                <p className="text-muted-foreground">{game.note}</p>
              </div>
            )}

            {game.players && game.players.length > 0 && (
              <div>
                <p className="mb-3 text-sm font-medium">
                  <Trans>Players:</Trans>
                </p>
                <div className="space-y-2">
                  {game.players.map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        player.is_winner
                          ? "bg-primary/10 border border-primary"
                          : "bg-secondary"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          nickname={player.user.nickname}
                          avatarUrl={player.user.avatar_url}
                          size="sm"
                          showFallback={false}
                        />
                        <span className="font-medium">
                          {player.user.nickname}
                        </span>
                        {player.is_winner && <span>👑</span>}
                      </div>
                      {player.score !== null && (
                        <span className="text-lg font-semibold">
                          {player.score}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Comments</Trans>
            </CardTitle>
            <CardDescription>
              <Trans>Share your thoughts about this game session</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddComment} className="space-y-4">
              <Textarea
                placeholder={_(t`Write a comment...`)}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={submitting}
                rows={3}
              />
              <Button type="submit" disabled={submitting || !newComment.trim()}>
                {submitting ? (
                  <Trans>Adding...</Trans>
                ) : (
                  <Trans>Add Comment</Trans>
                )}
              </Button>
            </form>

            {game.comments && game.comments.length > 0 ? (
              <div className="mt-6 space-y-4">
                {game.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="pl-4 border-l-2 border-primary"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <UserAvatar
                        nickname={comment.user.nickname}
                        avatarUrl={comment.user.avatar_url}
                        size="xs"
                        showFallback={false}
                      />
                      <span className="font-medium">
                        {comment.user.nickname}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-sm">{comment.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-muted-foreground">
                <Trans>No comments yet. Be the first to comment!</Trans>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <Trans>Delete Game Session</Trans>
              </DialogTitle>
              <DialogDescription>
                <Trans>
                  Are you sure you want to permanently delete this game session? This will remove all player scores and comments. This action cannot be undone.
                </Trans>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
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
