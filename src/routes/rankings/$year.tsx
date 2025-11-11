import { createFileRoute } from '@tanstack/react-router';
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
import type { BoardGame, UserGameRanking, RankingYear } from '@/types';

export const Route = createFileRoute('/rankings/$year')({
  component: YearRankingsPage,
  beforeLoad: async () => {
    await requireAuth();
  },
});

interface RankedGame {
  boardGame: BoardGame;
  rank: number;
  rankingId?: string;
  isManuallyAdded: boolean;
}

function YearRankingsPage() {
  const { year } = Route.useParams();
  const { user } = useAuthContext();
  const { _ } = useLingui();
  const { toast } = useToast();
  const [yearInfo, setYearInfo] = useState<RankingYear | null>(null);
  const [rankedGames, setRankedGames] = useState<RankedGame[]>([]);
  const [availableGames, setAvailableGames] = useState<BoardGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [year, user]);

  async function loadData() {
    if (!user) return;

    setLoading(true);
    try {
      // Load year info
      const { data: yearData, error: yearError } = await supabase
        .from('ranking_years')
        .select('*')
        .eq('year', parseInt(year))
        .single();

      if (yearError) throw yearError;
      setYearInfo(yearData);

      // Load user's existing rankings
      const { data: rankingsData, error: rankingsError } = await supabase
        .from('user_game_rankings')
        .select('*, board_game:board_games(*)')
        .eq('user_id', user.id)
        .eq('year', parseInt(year))
        .order('rank');

      if (rankingsError) throw rankingsError;

      const ranked: RankedGame[] = (rankingsData || []).map((r: any) => ({
        boardGame: r.board_game,
        rank: r.rank,
        rankingId: r.id,
        isManuallyAdded: r.is_manually_added,
      }));

      setRankedGames(ranked);

      // Load games played in this year that aren't ranked yet
      const { data: playedGamesData, error: playedError } = await supabase
        .from('played_games')
        .select(`
          board_game_id,
          board_game:board_games(*),
          players:played_game_players!inner(user_id)
        `)
        .eq('players.user_id', user.id)
        .gte('played_at', `${year}-01-01`)
        .lte('played_at', `${year}-12-31`);

      if (playedError) throw playedError;

      // Filter out already ranked games
      const rankedGameIds = new Set(ranked.map(rg => rg.boardGame.id));
      const uniqueGames = new Map<string, BoardGame>();

      (playedGamesData || []).forEach((pg: any) => {
        if (!rankedGameIds.has(pg.board_game.id)) {
          uniqueGames.set(pg.board_game.id, pg.board_game);
        }
      });

      setAvailableGames(Array.from(uniqueGames.values()));
    } catch (error: any) {
      toast({
        title: _(t`Error loading rankings`),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveRankings() {
    if (!user || !yearInfo) return;

    setSaving(true);
    try {
      // Delete existing rankings
      const { error: deleteError } = await supabase
        .from('user_game_rankings')
        .delete()
        .eq('user_id', user.id)
        .eq('year', yearInfo.year);

      if (deleteError) throw deleteError;

      // Insert new rankings
      if (rankedGames.length > 0) {
        const rankings = rankedGames.map((rg, index) => ({
          user_id: user.id,
          board_game_id: rg.boardGame.id,
          year: yearInfo.year,
          rank: index + 1,
          is_manually_added: rg.isManuallyAdded,
        }));

        const { error: insertError } = await supabase
          .from('user_game_rankings')
          .insert(rankings);

        if (insertError) throw insertError;
      }

      toast({
        title: _(t`Rankings saved`),
        description: _(t`Your rankings have been saved successfully`),
      });

      loadData();
    } catch (error: any) {
      toast({
        title: _(t`Error saving rankings`),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newRanked = [...rankedGames];
    const draggedItem = newRanked[draggedIndex];
    newRanked.splice(draggedIndex, 1);
    newRanked.splice(index, 0, draggedItem);

    setRankedGames(newRanked);
    setDraggedIndex(index);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
  }

  function addGameToRankings(game: BoardGame) {
    setRankedGames([...rankedGames, {
      boardGame: game,
      rank: rankedGames.length + 1,
      isManuallyAdded: false,
    }]);
    setAvailableGames(availableGames.filter(g => g.id !== game.id));
  }

  function removeGameFromRankings(index: number) {
    const game = rankedGames[index];
    if (!game.isManuallyAdded) {
      setAvailableGames([...availableGames, game.boardGame]);
    }
    setRankedGames(rankedGames.filter((_, i) => i !== index));
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

  if (!yearInfo) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              <Trans>Year not found</Trans>
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const isLocked = yearInfo.is_locked;

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              <Trans>Rankings for {yearInfo.year}</Trans>
            </h1>
            <p className="text-muted-foreground">
              {isLocked ? (
                <span className="text-orange-500">
                  <Trans>Rankings are locked</Trans>
                </span>
              ) : (
                <Trans>Drag games to reorder your rankings</Trans>
              )}
            </p>
          </div>

          {!isLocked && (
            <Button onClick={handleSaveRankings} disabled={saving}>
              {saving ? <Trans>Saving...</Trans> : <Trans>Save Rankings</Trans>}
            </Button>
          )}
        </div>

        {yearInfo.deadline && !isLocked && (
          <Card className="border-orange-500">
            <CardContent className="pt-6">
              <p className="text-sm font-medium">
                <Trans>Deadline: {new Date(yearInfo.deadline).toLocaleDateString()}</Trans>
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Your Rankings</Trans>
            </CardTitle>
            <CardDescription>
              {isLocked ? (
                <Trans>View your final rankings</Trans>
              ) : (
                <Trans>Rank 1 = Most Favorite, Rank {rankedGames.length} = Least Favorite</Trans>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rankedGames.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                <Trans>No games ranked yet. Add games from below to start ranking.</Trans>
              </p>
            ) : (
              <div className="space-y-2">
                {rankedGames.map((rg, index) => (
                  <div
                    key={`${rg.boardGame.id}-${index}`}
                    draggable={!isLocked}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-4 p-4 border rounded-lg ${
                      !isLocked ? 'cursor-move hover:bg-accent' : ''
                    } ${draggedIndex === index ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                      {index + 1}
                    </div>

                    {rg.boardGame.image_url && (
                      <img
                        src={rg.boardGame.image_url}
                        alt={rg.boardGame.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}

                    <div className="flex-1">
                      <p className="font-medium">{rg.boardGame.name}</p>
                      {rg.boardGame.year_published && (
                        <p className="text-sm text-muted-foreground">
                          {rg.boardGame.year_published}
                        </p>
                      )}
                    </div>

                    {!isLocked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeGameFromRankings(index)}
                      >
                        <Trans>Remove</Trans>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {!isLocked && availableGames.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Games You Played in {yearInfo.year}</Trans>
              </CardTitle>
              <CardDescription>
                <Trans>Click to add to your rankings</Trans>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {availableGames.map((game) => (
                  <div
                    key={game.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => addGameToRankings(game)}
                  >
                    {game.image_url && (
                      <img
                        src={game.image_url}
                        alt={game.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{game.name}</p>
                      {game.year_published && (
                        <p className="text-sm text-muted-foreground">
                          {game.year_published}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
