import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { requireRole } from "@/lib/auth-helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ChevronDown, ChevronUp, Users } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { RankingYear } from "@/types";

interface PlayerSubmission {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  last_updated: string;
  games_ranked: number;
}

export const Route = createFileRoute("/rankings/manage")({
  component: ManageRankingsPage,
  beforeLoad: async () => {
    await requireRole("moderator");
  },
});

function ManageRankingsPage() {
  const { _ } = useLingui();
  const { toast } = useToast();
  const router = useRouter();
  const [years, setYears] = useState<RankingYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [newDeadline, setNewDeadline] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<Record<number, PlayerSubmission[]>>({});
  const [loadingSubmissions, setLoadingSubmissions] = useState<Set<number>>(new Set());

  function handleBack() {
    if (router.history.length <= 1) {
      router.navigate({ to: "/rankings" });
    } else {
      router.history.back();
    }
  }

  useEffect(() => {
    loadYears();
  }, []);

  async function loadYears() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ranking_years")
        .select("*")
        .order("year", { ascending: false });

      if (error) throw error;
      setYears(data || []);
    } catch (error: any) {
      toast({
        title: _(t`Error loading years`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateYear() {
    setCreating(true);
    try {
      const { error } = await supabase.from("ranking_years").insert({
        year: parseInt(newYear),
        deadline: newDeadline || null,
        is_locked: false,
        is_public: false,
      });

      if (error) throw error;

      toast({
        title: _(t`Year created`),
        description: _(t`Ranking year has been created successfully`),
      });

      setCreateDialogOpen(false);
      setNewYear((new Date().getFullYear() + 1).toString());
      setNewDeadline("");
      loadYears();
    } catch (error: any) {
      toast({
        title: _(t`Error creating year`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  async function toggleLock(yearId: string, currentLocked: boolean) {
    try {
      const { error } = await supabase
        .from("ranking_years")
        .update({ is_locked: !currentLocked })
        .eq("id", yearId);

      if (error) throw error;

      toast({
        title: currentLocked ? _(t`Year unlocked`) : _(t`Year locked`),
        description: currentLocked
          ? _(t`Users can now edit their rankings`)
          : _(t`Rankings are now locked from editing`),
      });

      loadYears();
    } catch (error: any) {
      toast({
        title: _(t`Error updating year`),
        description: error.message,
        variant: "destructive",
      });
    }
  }

  async function togglePublic(yearId: string, currentPublic: boolean) {
    try {
      const { error } = await supabase
        .from("ranking_years")
        .update({ is_public: !currentPublic })
        .eq("id", yearId);

      if (error) throw error;

      toast({
        title: currentPublic ? _(t`Results hidden`) : _(t`Results published`),
        description: currentPublic
          ? _(t`Results are no longer visible to players`)
          : _(t`Results are now visible to all players`),
      });

      loadYears();
    } catch (error: any) {
      toast({
        title: _(t`Error updating year`),
        description: error.message,
        variant: "destructive",
      });
    }
  }

  async function updateDeadline(yearId: string, newDeadlineValue: string) {
    try {
      const { error } = await supabase
        .from("ranking_years")
        .update({ deadline: newDeadlineValue || null })
        .eq("id", yearId);

      if (error) throw error;

      toast({
        title: _(t`Deadline updated`),
        description: _(t`Ranking deadline has been updated`),
      });

      loadYears();
    } catch (error: any) {
      toast({
        title: _(t`Error updating deadline`),
        description: error.message,
        variant: "destructive",
      });
    }
  }

  async function loadSubmissions(year: number) {
    if (submissions[year] || loadingSubmissions.has(year)) return;

    setLoadingSubmissions((prev) => new Set(prev).add(year));
    try {
      const { data, error } = await supabase
        .from("user_game_rankings")
        .select(
          `
          user_id,
          updated_at,
          users(id, nickname, avatar_url)
        `
        )
        .eq("year", year);

      if (error) throw error;

      // Group by user and get last update time and count
      const userMap = new Map<
        string,
        { nickname: string; avatar_url: string | null; last_updated: string; count: number }
      >();

      for (const ranking of data || []) {
        const user = ranking.users as unknown as {
          id: string;
          nickname: string;
          avatar_url: string | null;
        };
        if (!user) continue;

        const existing = userMap.get(ranking.user_id);
        if (!existing) {
          userMap.set(ranking.user_id, {
            nickname: user.nickname,
            avatar_url: user.avatar_url,
            last_updated: ranking.updated_at,
            count: 1,
          });
        } else {
          existing.count++;
          if (new Date(ranking.updated_at) > new Date(existing.last_updated)) {
            existing.last_updated = ranking.updated_at;
          }
        }
      }

      const playerSubmissions: PlayerSubmission[] = Array.from(userMap.entries())
        .map(([user_id, data]) => ({
          user_id,
          nickname: data.nickname,
          avatar_url: data.avatar_url,
          last_updated: data.last_updated,
          games_ranked: data.count,
        }))
        .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime());

      setSubmissions((prev) => ({ ...prev, [year]: playerSubmissions }));
    } catch (error: any) {
      toast({
        title: _(t`Error loading submissions`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingSubmissions((prev) => {
        const next = new Set(prev);
        next.delete(year);
        return next;
      });
    }
  }

  function toggleExpanded(yearId: string, yearNumber: number) {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(yearId)) {
        next.delete(yearId);
      } else {
        next.add(yearId);
        loadSubmissions(yearNumber);
      }
      return next;
    });
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex gap-4 text-3xl font-bold">
              <Trans>Manage Ranking Years</Trans>
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
              <Trans>Configure ranking years, deadlines, and visibility</Trans>
            </p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Trans>Create Year</Trans>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  <Trans>Create Ranking Year</Trans>
                </DialogTitle>
                <DialogDescription>
                  <Trans>Set up a new year for game rankings</Trans>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="year">
                    <Trans>Year</Trans>
                  </Label>
                  <Input
                    id="year"
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    min="2000"
                    max="2100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deadline">
                    <Trans>Deadline (Optional)</Trans>
                  </Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button onClick={handleCreateYear} disabled={creating}>
                  {creating ? (
                    <Trans>Creating...</Trans>
                  ) : (
                    <Trans>Create</Trans>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                <Trans>Loading...</Trans>
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {years.map((year) => (
              <Card key={year.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{year.year}</CardTitle>
                      <CardDescription>
                        <Trans>
                          Created{" "}
                          {new Date(year.created_at).toLocaleDateString()}
                        </Trans>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          year.is_locked
                            ? "bg-orange-100 text-orange-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {year.is_locked ? (
                          <Trans>Locked</Trans>
                        ) : (
                          <Trans>Open</Trans>
                        )}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          year.is_public
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {year.is_public ? (
                          <Trans>Public</Trans>
                        ) : (
                          <Trans>Private</Trans>
                        )}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`deadline-${year.id}`}>
                      <Trans>Deadline</Trans>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={`deadline-${year.id}`}
                        type="date"
                        defaultValue={
                          year.deadline
                            ? new Date(year.deadline)
                                .toISOString()
                                .split("T")[0]
                            : ""
                        }
                        onBlur={(e) => updateDeadline(year.id, e.target.value)}
                      />
                    </div>
                    {year.deadline && (
                      <p className="text-xs text-muted-foreground">
                        <Trans>
                          Deadline:{" "}
                          {new Date(year.deadline).toLocaleDateString()}
                        </Trans>
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant={year.is_locked ? "default" : "destructive"}
                      onClick={() => toggleLock(year.id, year.is_locked)}
                    >
                      {year.is_locked ? (
                        <Trans>Unlock</Trans>
                      ) : (
                        <Trans>Lock</Trans>
                      )}
                    </Button>
                    <Button
                      variant={year.is_public ? "outline" : "default"}
                      onClick={() => togglePublic(year.id, year.is_public)}
                    >
                      {year.is_public ? (
                        <Trans>Hide Results</Trans>
                      ) : (
                        <Trans>Publish Results</Trans>
                      )}
                    </Button>
                  </div>

                  <div className="border-t pt-4">
                    <Button
                      variant="ghost"
                      className="w-full justify-between"
                      onClick={() => toggleExpanded(year.id, year.year)}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>
                          <Trans>Player Submissions</Trans>
                          {submissions[year.year] && (
                            <span className="ml-2 text-muted-foreground">
                              ({submissions[year.year].length})
                            </span>
                          )}
                        </span>
                      </div>
                      {expandedYears.has(year.id) ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>

                    {expandedYears.has(year.id) && (
                      <div className="mt-3 space-y-2">
                        {loadingSubmissions.has(year.year) ? (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            <Trans>Loading submissions...</Trans>
                          </p>
                        ) : submissions[year.year]?.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            <Trans>No submissions yet</Trans>
                          </p>
                        ) : (
                          submissions[year.year]?.map((player) => (
                            <div
                              key={player.user_id}
                              className="flex items-center justify-between p-2 bg-secondary rounded"
                            >
                              <div className="flex items-center gap-2">
                                <UserAvatar
                                  nickname={player.nickname}
                                  avatarUrl={player.avatar_url}
                                  size="sm"
                                />
                                <div>
                                  <p className="font-medium text-sm">
                                    {player.nickname}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    <Trans>
                                      {player.games_ranked} games ranked
                                    </Trans>
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">
                                  <Trans>Last updated</Trans>
                                </p>
                                <p className="text-sm">
                                  {new Date(player.last_updated).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
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
