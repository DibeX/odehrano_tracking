import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { requireRole } from "@/lib/auth-helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { BoardGame, User, PlayedGameWithDetails } from "@/types";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/games/sessions/edit/$sessionId")({
  component: EditSessionPage,
  beforeLoad: async () => {
    await requireRole("moderator");
  },
});

interface PlayerScore {
  odehrano_tracking: string;
  score: string;
  isWinner: boolean;
}

function EditSessionPage() {
  const { sessionId } = Route.useParams();
  const { _ } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();
  const router = useRouter();

  const [session, setSession] = useState<PlayedGameWithDetails | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [playedAt, setPlayedAt] = useState("");
  const [note, setNote] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(
    new Set()
  );
  const [playerScores, setPlayerScores] = useState<Map<string, PlayerScore>>(
    new Map()
  );
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  function handleBack() {
    if (router.history.length <= 1) {
      router.navigate({ to: "/games" });
    } else {
      router.history.back();
    }
  }

  useEffect(() => {
    loadData();
  }, [sessionId]);

  async function loadData() {
    setLoading(true);
    try {
      const [sessionResponse, usersResponse] = await Promise.all([
        supabase
          .from("played_games")
          .select(
            `
            *,
            board_game:board_games(*),
            players:played_game_players(
              *,
              user:users(*)
            )
          `
          )
          .eq("id", sessionId)
          .single(),
        supabase.from("users").select("*").order("nickname"),
      ]);

      if (sessionResponse.error) throw sessionResponse.error;
      if (usersResponse.error) throw usersResponse.error;

      const sessionData = sessionResponse.data as PlayedGameWithDetails;
      setSession(sessionData);
      setUsers(usersResponse.data || []);

      // Set initial form values
      setPlayedAt(sessionData.played_at.split("T")[0]);
      setNote(sessionData.note || "");

      // Set initial players and scores
      const initialPlayers = new Set<string>();
      const initialScores = new Map<string, PlayerScore>();

      sessionData.players?.forEach((player) => {
        initialPlayers.add(player.user_id);
        initialScores.set(player.user_id, {
          odehrano_tracking: player.user_id,
          score: player.score?.toString() || "",
          isWinner: player.is_winner,
        });
      });

      setSelectedPlayers(initialPlayers);
      setPlayerScores(initialScores);
    } catch (error: any) {
      toast({
        title: _(t`Error loading session`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function togglePlayer(odehrano_tracking: string) {
    const newSelected = new Set(selectedPlayers);
    if (newSelected.has(odehrano_tracking)) {
      newSelected.delete(odehrano_tracking);
      const newScores = new Map(playerScores);
      newScores.delete(odehrano_tracking);
      setPlayerScores(newScores);
    } else {
      newSelected.add(odehrano_tracking);
      const newScores = new Map(playerScores);
      newScores.set(odehrano_tracking, { odehrano_tracking, score: "", isWinner: false });
      setPlayerScores(newScores);
    }
    setSelectedPlayers(newSelected);
  }

  function updatePlayerScore(odehrano_tracking: string, score: string) {
    const newScores = new Map(playerScores);
    const current = newScores.get(odehrano_tracking);
    if (current) {
      newScores.set(odehrano_tracking, { ...current, score });
      setPlayerScores(newScores);
    }
  }

  function toggleWinner(odehrano_tracking: string) {
    const newScores = new Map(playerScores);
    const current = newScores.get(odehrano_tracking);
    if (current) {
      newScores.set(odehrano_tracking, { ...current, isWinner: !current.isWinner });
      setPlayerScores(newScores);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (selectedPlayers.size === 0) {
      toast({
        title: _(t`Players required`),
        description: _(t`Please select at least one player`),
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Update the played game
      const { error: updateError } = await supabase
        .from("played_games")
        .update({
          played_at: playedAt,
          note: note || null,
        })
        .eq("id", sessionId);

      if (updateError) throw updateError;

      // Delete existing player records
      const { error: deleteError } = await supabase
        .from("played_game_players")
        .delete()
        .eq("played_game_id", sessionId);

      if (deleteError) throw deleteError;

      // Insert new player records
      const playerRecords = Array.from(selectedPlayers).map((playerId) => {
        const playerScore = playerScores.get(playerId);
        return {
          played_game_id: sessionId,
          user_id: playerId,
          score: playerScore?.score ? parseFloat(playerScore.score) : null,
          is_winner: playerScore?.isWinner || false,
        };
      });

      const { error: playersError } = await supabase
        .from("played_game_players")
        .insert(playerRecords);

      if (playersError) throw playersError;

      toast({
        title: _(t`Session updated`),
        description: _(t`The play session has been updated successfully`),
      });

      navigate({ to: "/games/$gameId", params: { gameId: sessionId } });
    } catch (error: any) {
      toast({
        title: _(t`Error updating session`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto">
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

  if (!session) {
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
                <Trans>Session not found</Trans>
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            <Trans>Back</Trans>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              <Trans>Edit Play Session</Trans>
            </h1>
            <p className="mt-2 text-muted-foreground">
              <Trans>
                Update the details of this game session
              </Trans>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Game Info (read-only) */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Game</Trans>
              </CardTitle>
              <CardDescription>
                <Trans>The game that was played (cannot be changed)</Trans>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                {session.board_game.image_url && (
                  <img
                    src={session.board_game.image_url}
                    alt={session.board_game.name}
                    className="object-cover w-16 h-16 rounded"
                  />
                )}
                <div>
                  <p className="font-medium">{session.board_game.name}</p>
                  {session.board_game.year_published && (
                    <p className="text-sm text-muted-foreground">
                      {session.board_game.year_published}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Session Details */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Session Details</Trans>
              </CardTitle>
              <CardDescription>
                <Trans>When was the game played?</Trans>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  placeholder={_(
                    t`Any notes about this game session...`
                  )}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={submitting}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Players */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Players</Trans>
              </CardTitle>
              <CardDescription>
                <Trans>Select who played and update their scores</Trans>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <Trans>No users found</Trans>
                </p>
              ) : (
                users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-4 p-4 border rounded-lg"
                  >
                    <input
                      type="checkbox"
                      id={`player-${u.id}`}
                      checked={selectedPlayers.has(u.id)}
                      onChange={() => togglePlayer(u.id)}
                      disabled={submitting}
                      className="w-4 h-4"
                    />
                    <Label
                      htmlFor={`player-${u.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      {u.nickname}
                    </Label>

                    {selectedPlayers.has(u.id) && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder={_(t`Score`)}
                          value={playerScores.get(u.id)?.score || ""}
                          onChange={(e) =>
                            updatePlayerScore(u.id, e.target.value)
                          }
                          disabled={submitting}
                          className="w-24"
                          step="0.01"
                        />
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              playerScores.get(u.id)?.isWinner || false
                            }
                            onChange={() => toggleWinner(u.id)}
                            disabled={submitting}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">
                            <Trans>Winner</Trans>
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Trans>Saving...</Trans>
              ) : (
                <Trans>Save Changes</Trans>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={submitting}
            >
              <Trans>Cancel</Trans>
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
