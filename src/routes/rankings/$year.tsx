import { createFileRoute, useRouter } from "@tanstack/react-router";
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
import { Plus, ArrowLeft, ChevronUp, ChevronDown, X } from "lucide-react";
import type { BoardGame, UserGameRanking, RankingYear } from "@/types";

export const Route = createFileRoute("/rankings/$year")({
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
  sourceList?: "user" | "other"; // Track which list the game came from
}

function YearRankingsPage() {
  const { year } = Route.useParams();
  const { user } = useAuthContext();
  const { _ } = useLingui();
  const { toast } = useToast();
  const router = useRouter();
  const [yearInfo, setYearInfo] = useState<RankingYear | null>(null);
  const [rankedGames, setRankedGames] = useState<RankedGame[]>([]);
  const [availableGames, setAvailableGames] = useState<BoardGame[]>([]);
  const [otherAvailableGames, setOtherAvailableGames] = useState<BoardGame[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialRankedGames, setInitialRankedGames] = useState<RankedGame[]>(
    []
  );
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  function handleBack() {
    if (router.history.length <= 1) {
      router.navigate({ to: "/rankings" });
    } else {
      router.history.back();
    }
  }

  const localStorageKey = `rankings_${year}_${user?.id}`;
  const lastSavedKey = `rankings_last_saved_${year}_${user?.id}`;

  function saveToLocalStorage(games: RankedGame[]) {
    localStorage.setItem(localStorageKey, JSON.stringify(games));
  }

  function loadFromLocalStorage(): RankedGame[] | null {
    const stored = localStorage.getItem(localStorageKey);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }

  function clearLocalStorage() {
    localStorage.removeItem(localStorageKey);
  }

  function saveLastSavedTimestamp() {
    const timestamp = new Date().toISOString();
    localStorage.setItem(lastSavedKey, timestamp);
    setLastSavedAt(new Date(timestamp));
  }

  function loadLastSavedTimestamp() {
    const stored = localStorage.getItem(lastSavedKey);
    if (stored) {
      setLastSavedAt(new Date(stored));
    } else {
      setLastSavedAt(null);
    }
  }

  function handleDiscardChanges() {
    clearLocalStorage();
    setRankedGames(initialRankedGames);
    setHasUnsavedChanges(false);

    // Rebuild available games lists
    const rankedGameIds = new Set(
      initialRankedGames.map((rg) => rg.boardGame.id)
    );

    // We need to reload to get fresh available games
    loadData();

    toast({
      title: _(t`Changes discarded`),
      description: _(t`Your unsaved changes have been discarded`),
    });
  }

  function checkForChanges(current: RankedGame[], initial: RankedGame[]) {
    if (current.length !== initial.length) return true;
    for (let i = 0; i < current.length; i++) {
      if (current[i].boardGame.id !== initial[i].boardGame.id) return true;
    }
    return false;
  }

  useEffect(() => {
    loadData();
    loadLastSavedTimestamp();
  }, [year, user]);

  // Save to localStorage and track changes whenever rankedGames changes
  useEffect(() => {
    if (!loading && user && initialRankedGames.length >= 0) {
      saveToLocalStorage(rankedGames);
      setHasUnsavedChanges(checkForChanges(rankedGames, initialRankedGames));
    }
  }, [rankedGames, initialRankedGames, loading, user]);

  async function loadData() {
    if (!user) return;

    setLoading(true);
    try {
      // Load year info
      const { data: yearData, error: yearError } = await supabase
        .from("ranking_years")
        .select("*")
        .eq("year", parseInt(year))
        .single();

      if (yearError) throw yearError;
      setYearInfo(yearData);

      // Load user's existing rankings
      const { data: rankingsData, error: rankingsError } = await supabase
        .from("user_game_rankings")
        .select(
          "id, rank, is_manually_added, updated_at, board_game:board_games(*)"
        )
        .eq("user_id", user.id)
        .eq("year", parseInt(year))
        .order("rank");

      if (rankingsError) throw rankingsError;

      const ranked: RankedGame[] = (rankingsData || []).map((r: any) => ({
        boardGame: r.board_game,
        rank: r.rank,
        rankingId: r.id,
        isManuallyAdded: r.is_manually_added,
      }));

      setInitialRankedGames(ranked);

      // Get the most recent updated_at timestamp from the rankings
      if (rankingsData && rankingsData.length > 0) {
        const timestamps = rankingsData.map((r: any) => new Date(r.updated_at));
        const mostRecent = new Date(
          Math.max(...timestamps.map((d) => d.getTime()))
        );
        setLastSavedAt(mostRecent);
        // Also save it to localStorage for consistency
        localStorage.setItem(lastSavedKey, mostRecent.toISOString());
      }

      // Load games the user played in this year
      const { data: userPlayedGamesData, error: userPlayedError } =
        await supabase
          .from("played_games")
          .select(
            `
          board_game_id,
          board_game:board_games(*),
          players:played_game_players!inner(user_id)
        `
          )
          .eq("players.user_id", user.id)
          .gte("played_at", `${year}-01-01`)
          .lte("played_at", `${year}-12-31`);

      if (userPlayedError) throw userPlayedError;

      // Load all games with sessions in this year (for "other games" section)
      const { data: allPlayedGamesData, error: allPlayedError } = await supabase
        .from("played_games")
        .select(
          `
          board_game_id,
          board_game:board_games(*)
        `
        )
        .gte("played_at", `${year}-01-01`)
        .lte("played_at", `${year}-12-31`);

      if (allPlayedError) throw allPlayedError;

      // Build set of all valid game IDs (games that can be ranked)
      const allValidGameIds = new Set<string>();
      (userPlayedGamesData || []).forEach((pg: any) => {
        allValidGameIds.add(pg.board_game.id);
      });
      (allPlayedGamesData || []).forEach((pg: any) => {
        allValidGameIds.add(pg.board_game.id);
      });

      // Check for localStorage data and validate it
      const localData = loadFromLocalStorage();
      let currentRankedGames: RankedGame[];
      if (localData && localData.length > 0) {
        // Validate: only keep games that are valid (played in this year)
        const validLocalData = localData.filter((rg) =>
          allValidGameIds.has(rg.boardGame.id)
        );
        if (validLocalData.length > 0) {
          currentRankedGames = validLocalData;
          setRankedGames(validLocalData);
          setHasUnsavedChanges(checkForChanges(validLocalData, ranked));
        } else {
          currentRankedGames = ranked;
          setRankedGames(ranked);
          setHasUnsavedChanges(false);
          clearLocalStorage();
        }
      } else {
        currentRankedGames = ranked;
        setRankedGames(ranked);
        setHasUnsavedChanges(false);
      }

      // Filter out already ranked games
      const rankedGameIds = new Set(
        currentRankedGames.map((rg) => rg.boardGame.id)
      );
      const userPlayedGameIds = new Set(
        (userPlayedGamesData || []).map((pg: any) => pg.board_game.id)
      );

      const userGames = new Map<string, BoardGame>();
      const otherGames = new Map<string, BoardGame>();

      // Add user's played games
      (userPlayedGamesData || []).forEach((pg: any) => {
        if (!rankedGameIds.has(pg.board_game.id)) {
          userGames.set(pg.board_game.id, pg.board_game);
        }
      });

      // Add other games (played by others but not by user)
      (allPlayedGamesData || []).forEach((pg: any) => {
        if (
          !rankedGameIds.has(pg.board_game.id) &&
          !userPlayedGameIds.has(pg.board_game.id)
        ) {
          otherGames.set(pg.board_game.id, pg.board_game);
        }
      });

      setAvailableGames(Array.from(userGames.values()));
      setOtherAvailableGames(Array.from(otherGames.values()));
    } catch (error: any) {
      toast({
        title: _(t`Error loading rankings`),
        description: error.message,
        variant: "destructive",
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
        .from("user_game_rankings")
        .delete()
        .eq("user_id", user.id)
        .eq("year", yearInfo.year);

      if (deleteError) throw deleteError;

      // Insert new rankings (deduplicate by board_game_id to prevent constraint violations)
      if (rankedGames.length > 0) {
        const seenGameIds = new Set<string>();
        const rankings: Array<{
          user_id: string;
          board_game_id: string;
          year: number;
          rank: number;
          is_manually_added: boolean;
        }> = [];

        rankedGames.forEach((rg, index) => {
          if (!seenGameIds.has(rg.boardGame.id)) {
            seenGameIds.add(rg.boardGame.id);
            rankings.push({
              user_id: user.id,
              board_game_id: rg.boardGame.id,
              year: yearInfo.year,
              rank: index + 1,
              is_manually_added: rg.isManuallyAdded,
            });
          }
        });

        const { error: insertError } = await supabase
          .from("user_game_rankings")
          .insert(rankings);

        if (insertError) throw insertError;
      }

      clearLocalStorage();
      saveLastSavedTimestamp();
      setHasUnsavedChanges(false);

      toast({
        title: _(t`Rankings saved`),
        description: _(t`Your rankings have been saved successfully`),
      });

      loadData();
    } catch (error: any) {
      toast({
        title: _(t`Error saving rankings`),
        description: error.message,
        variant: "destructive",
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

  function addGameToRankings(game: BoardGame, sourceList: "user" | "other") {
    setRankedGames([
      ...rankedGames,
      {
        boardGame: game,
        rank: rankedGames.length + 1,
        isManuallyAdded: sourceList === "other",
        sourceList,
      },
    ]);
    setAvailableGames(availableGames.filter((g) => g.id !== game.id));
    setOtherAvailableGames(otherAvailableGames.filter((g) => g.id !== game.id));
  }

  function removeGameFromRankings(index: number) {
    const game = rankedGames[index];
    // Return the game to its original list
    if (game.sourceList === "user") {
      setAvailableGames([...availableGames, game.boardGame]);
    } else if (game.sourceList === "other") {
      setOtherAvailableGames([...otherAvailableGames, game.boardGame]);
    }
    // If sourceList is undefined (loaded from DB), we don't add it back to any list
    setRankedGames(rankedGames.filter((_, i) => i !== index));
  }

  function moveGameUp(index: number) {
    if (index === 0) return;
    const newRanked = [...rankedGames];
    [newRanked[index - 1], newRanked[index]] = [
      newRanked[index],
      newRanked[index - 1],
    ];
    setRankedGames(newRanked);
  }

  function moveGameDown(index: number) {
    if (index === rankedGames.length - 1) return;
    const newRanked = [...rankedGames];
    [newRanked[index], newRanked[index + 1]] = [
      newRanked[index + 1],
      newRanked[index],
    ];
    setRankedGames(newRanked);
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
            <h1 className="flex gap-4 text-3xl font-bold">
              <Trans>Rankings for {yearInfo.year}</Trans>
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
            <div className="flex gap-2">
              {hasUnsavedChanges && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleDiscardChanges}
                    disabled={saving}
                  >
                    <X className="w-4 h-4 mr-2" />
                    <Trans>Discard Changes</Trans>
                  </Button>
                  <Button onClick={handleSaveRankings} disabled={saving}>
                    {saving ? (
                      <Trans>Saving...</Trans>
                    ) : (
                      <Trans>Save Rankings</Trans>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {yearInfo.deadline && !isLocked && (
          <Card className="border-orange-500">
            <CardContent className="pt-6">
              <p className="text-sm font-medium">
                <Trans>
                  Deadline: {new Date(yearInfo.deadline).toLocaleDateString()}
                </Trans>
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  <Trans>Your Rankings</Trans>
                </CardTitle>
                <CardDescription>
                  {isLocked ? (
                    <Trans>View your final rankings</Trans>
                  ) : (
                    <Trans>
                      Rank 1 = Most Favorite, Rank {rankedGames.length} = Least
                      Favorite
                    </Trans>
                  )}
                </CardDescription>
              </div>
              {lastSavedAt && (
                <p className="text-sm text-muted-foreground">
                  <Trans>Last saved: {lastSavedAt.toLocaleString()}</Trans>
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {rankedGames.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                <Trans>
                  No games ranked yet. Add games from below to start ranking.
                </Trans>
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
                    onDrop={handleDragEnd}
                    className={`flex items-center gap-4 px-4 py-2 border rounded-lg ${
                      !isLocked ? "cursor-move hover:bg-accent" : ""
                    } ${draggedIndex === index ? "opacity-50" : ""}`}
                  >
                    {!isLocked && (
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-8 h-8"
                          onClick={() => moveGameUp(index)}
                          disabled={index === 0}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-8 h-8"
                          onClick={() => moveGameDown(index)}
                          disabled={index === rankedGames.length - 1}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-center w-8 h-8 font-bold rounded-full bg-primary text-primary-foreground">
                      {index + 1}
                    </div>

                    {rg.boardGame.image_url && (
                      <img
                        src={rg.boardGame.image_url}
                        alt={rg.boardGame.name}
                        className="object-cover rounded size-16"
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
                    className="flex items-center gap-4 p-4 border rounded-lg cursor-pointer hover:bg-accent"
                    onClick={() => addGameToRankings(game, "user")}
                  >
                    {game.image_url && (
                      <img
                        src={game.image_url}
                        alt={game.name}
                        className="object-cover w-12 h-12 rounded"
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
                    <Plus className="w-5 h-5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!isLocked && otherAvailableGames.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Other Games Played in {yearInfo.year}</Trans>
              </CardTitle>
              <CardDescription>
                <Trans>Games you didn't play but can still rank</Trans>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {otherAvailableGames.map((game) => (
                  <div
                    key={game.id}
                    className="flex items-center gap-4 p-4 border rounded-lg cursor-pointer hover:bg-accent"
                    onClick={() => addGameToRankings(game, "other")}
                  >
                    {game.image_url && (
                      <img
                        src={game.image_url}
                        alt={game.name}
                        className="object-cover w-12 h-12 rounded"
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
                    <Plus className="w-5 h-5 text-muted-foreground" />
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
