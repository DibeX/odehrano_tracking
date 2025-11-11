import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { requireAuth } from '@/lib/auth-helpers';
import { useAuthContext } from '@/contexts/auth-context';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import type { PlayedGameWithDetails } from '@/types';

export const Route = createFileRoute('/games/$gameId')({
  component: GameDetailsPage,
  beforeLoad: async () => {
    await requireAuth();
  },
});

function GameDetailsPage() {
  const { gameId } = Route.useParams();
  const { user } = useAuthContext();
  const { _ } = useLingui();
  const { toast } = useToast();
  const [game, setGame] = useState<PlayedGameWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadGame();
  }, [gameId]);

  async function loadGame() {
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
          creator:users!created_by(*)
        `)
        .eq('id', gameId)
        .single();

      if (error) throw error;
      setGame(data as any);
    } catch (error: any) {
      toast({
        title: _(t`Error loading game`),
        description: error.message,
        variant: 'destructive',
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
      const { error } = await supabase.from('played_game_comments').insert({
        played_game_id: gameId,
        user_id: user.id,
        comment: newComment,
      });

      if (error) throw error;

      toast({
        title: _(t`Comment added`),
        description: _(t`Your comment has been added successfully`),
      });

      setNewComment('');
      loadGame();
    } catch (error: any) {
      toast({
        title: _(t`Error adding comment`),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              <Trans>Loading...</Trans>
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  if (!game) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              <Trans>Game not found</Trans>
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6">
        <Card>
          {game.board_game.image_url && (
            <div className="aspect-video overflow-hidden rounded-t-xl bg-muted">
              <img
                src={game.board_game.image_url}
                alt={game.custom_name || game.board_game.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <CardHeader>
            <CardTitle className="text-3xl">
              {game.custom_name || game.board_game.name}
            </CardTitle>
            {game.custom_name && (
              <p className="text-sm text-muted-foreground">
                <Trans>Original: {game.board_game.name}</Trans>
              </p>
            )}
            <CardDescription>
              <Trans>Played on {formatDate(game.played_at)}</Trans>
              {' • '}
              <Trans>Added by {game.creator?.nickname}</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {game.board_game.year_published && (
              <div>
                <p className="text-sm font-medium mb-1">
                  <Trans>Year Published:</Trans>
                </p>
                <p>{game.board_game.year_published}</p>
              </div>
            )}

            {game.board_game.categories.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">
                  <Trans>Categories:</Trans>
                </p>
                <div className="flex flex-wrap gap-2">
                  {game.board_game.categories.map((category) => (
                    <span
                      key={category}
                      className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-full"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {game.note && (
              <div>
                <p className="text-sm font-medium mb-1">
                  <Trans>Notes:</Trans>
                </p>
                <p className="text-muted-foreground">{game.note}</p>
              </div>
            )}

            {game.players && game.players.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-3">
                  <Trans>Players:</Trans>
                </p>
                <div className="space-y-2">
                  {game.players.map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        player.is_winner
                          ? 'bg-primary/10 border border-primary'
                          : 'bg-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{player.user.nickname}</span>
                        {player.is_winner && <span>👑</span>}
                      </div>
                      {player.score !== null && (
                        <span className="text-lg font-semibold">{player.score}</span>
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
                {submitting ? <Trans>Adding...</Trans> : <Trans>Add Comment</Trans>}
              </Button>
            </form>

            {game.comments && game.comments.length > 0 ? (
              <div className="space-y-4 mt-6">
                {game.comments.map((comment) => (
                  <div key={comment.id} className="border-l-2 border-primary pl-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{comment.user.nickname}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-sm">{comment.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                <Trans>No comments yet. Be the first to comment!</Trans>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
