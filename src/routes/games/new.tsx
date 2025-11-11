import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { requireRole } from '@/lib/auth-helpers';
import { useAuthContext } from '@/contexts/auth-context';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BGGGameSearch } from '@/components/features/bgg-game-search';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { BGGGameInfo, User } from '@/types';

export const Route = createFileRoute('/games/new')({
  component: NewGamePage,
  beforeLoad: async () => {
    await requireRole('moderator');
  },
});

interface PlayerScore {
  userId: string;
  score: string;
  isWinner: boolean;
}

function NewGamePage() {
  const { user } = useAuthContext();
  const { _ } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState<BGGGameInfo | null>(null);
  const [customName, setCustomName] = useState('');
  const [playedAt, setPlayedAt] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [playerScores, setPlayerScores] = useState<Map<string, PlayerScore>>(new Map());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('nickname');

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast({
        title: _(t`Error loading users`),
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  function handleGameSelected(game: BGGGameInfo) {
    setSelectedGame(game);
  }

  function togglePlayer(userId: string) {
    const newSelected = new Set(selectedPlayers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
      const newScores = new Map(playerScores);
      newScores.delete(userId);
      setPlayerScores(newScores);
    } else {
      newSelected.add(userId);
      const newScores = new Map(playerScores);
      newScores.set(userId, { userId, score: '', isWinner: false });
      setPlayerScores(newScores);
    }
    setSelectedPlayers(newSelected);
  }

  function updatePlayerScore(userId: string, score: string) {
    const newScores = new Map(playerScores);
    const current = newScores.get(userId);
    if (current) {
      newScores.set(userId, { ...current, score });
      setPlayerScores(newScores);
    }
  }

  function toggleWinner(userId: string) {
    const newScores = new Map(playerScores);
    const current = newScores.get(userId);
    if (current) {
      newScores.set(userId, { ...current, isWinner: !current.isWinner });
      setPlayerScores(newScores);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedGame) {
      toast({
        title: _(t`Game required`),
        description: _(t`Please select a game from BoardGameGeek`),
        variant: 'destructive',
      });
      return;
    }

    if (selectedPlayers.size === 0) {
      toast({
        title: _(t`Players required`),
        description: _(t`Please select at least one player`),
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (!user) throw new Error('User not found');

      // First, insert or update the board game
      const { data: existingGame } = await supabase
        .from('board_games')
        .select('id')
        .eq('bgg_id', selectedGame.id)
        .single();

      let boardGameId: string;

      if (existingGame) {
        boardGameId = existingGame.id;
      } else {
        const { data: newGame, error: gameError } = await supabase
          .from('board_games')
          .insert({
            bgg_id: selectedGame.id,
            name: selectedGame.name,
            image_url: selectedGame.imageUrl,
            year_published: selectedGame.yearPublished,
            categories: selectedGame.categories,
            bgg_rank: selectedGame.rank,
            bgg_rating: selectedGame.rating,
          })
          .select()
          .single();

        if (gameError) throw gameError;
        boardGameId = newGame.id;
      }

      // Insert the played game
      const { data: playedGame, error: playedError } = await supabase
        .from('played_games')
        .insert({
          board_game_id: boardGameId,
          custom_name: customName || null,
          played_at: playedAt,
          note: note || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (playedError) throw playedError;

      // Insert player records
      const playerRecords = Array.from(selectedPlayers).map((playerId) => {
        const playerScore = playerScores.get(playerId);
        return {
          played_game_id: playedGame.id,
          user_id: playerId,
          score: playerScore?.score ? parseFloat(playerScore.score) : null,
          is_winner: playerScore?.isWinner || false,
        };
      });

      const { error: playersError } = await supabase
        .from('played_game_players')
        .insert(playerRecords);

      if (playersError) throw playersError;

      toast({
        title: _(t`Game added`),
        description: _(t`The game session has been recorded successfully`),
      });

      navigate({ to: '/games' });
    } catch (error: any) {
      toast({
        title: _(t`Error adding game`),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            <Trans>Add Game Session</Trans>
          </h1>
          <p className="text-muted-foreground">
            <Trans>Record a new tabletop game session</Trans>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Select Game</Trans>
              </CardTitle>
              <CardDescription>
                <Trans>Search for the game on BoardGameGeek</Trans>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BGGGameSearch onGameSelected={handleGameSelected} />
            </CardContent>
          </Card>

          {selectedGame && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>
                    <Trans>Game Details</Trans>
                  </CardTitle>
                  <CardDescription>
                    <Trans>Optional additional information</Trans>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customName">
                      <Trans>Custom Name (Optional)</Trans>
                    </Label>
                    <Input
                      id="customName"
                      type="text"
                      placeholder={_(t`Override the game name for this session`)}
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      disabled={submitting}
                    />
                    <p className="text-xs text-muted-foreground">
                      <Trans>Original name: {selectedGame.name}</Trans>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="playedAt">
                      <Trans>Date Played</Trans>
                    </Label>
                    <Input
                      id="playedAt"
                      type="date"
                      value={playedAt}
                      onChange={(e) => setPlayedAt(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="note">
                      <Trans>Notes (Optional)</Trans>
                    </Label>
                    <Textarea
                      id="note"
                      placeholder={_(t`Any notes about this game session...`)}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      disabled={submitting}
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    <Trans>Players</Trans>
                  </CardTitle>
                  <CardDescription>
                    <Trans>Select who played and add their scores</Trans>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <input
                        type="checkbox"
                        id={`player-${u.id}`}
                        checked={selectedPlayers.has(u.id)}
                        onChange={() => togglePlayer(u.id)}
                        disabled={submitting}
                        className="h-4 w-4"
                      />
                      <Label htmlFor={`player-${u.id}`} className="flex-1 cursor-pointer">
                        {u.nickname}
                      </Label>

                      {selectedPlayers.has(u.id) && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder={_(t`Score`)}
                            value={playerScores.get(u.id)?.score || ''}
                            onChange={(e) => updatePlayerScore(u.id, e.target.value)}
                            disabled={submitting}
                            className="w-24"
                            step="0.01"
                          />
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={playerScores.get(u.id)?.isWinner || false}
                              onChange={() => toggleWinner(u.id)}
                              disabled={submitting}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">
                              <Trans>Winner</Trans>
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate({ to: '/games' })}
                  disabled={submitting}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Trans>Adding...</Trans> : <Trans>Add Game Session</Trans>}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </AppLayout>
  );
}
