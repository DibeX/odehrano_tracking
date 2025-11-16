import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { requireAuth } from "@/lib/auth-helpers";
import { useAuthContext } from "@/contexts/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save, Trash2, Pencil, Filter, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ResponsiveTooltip } from "@/components/ui/responsive-tooltip";
import { calculateRankings } from "@/services/ranking-calculator";
import type {
  RankingScheme,
  RankingYear,
  User,
  BoardGame,
  UserGameRanking,
  RankingResult,
  CategoryPreset,
} from "@/types";
import { GAME_CATEGORIES } from "@/constants/game-categories";

export const Route = createFileRoute("/results")({
  component: ResultsPage,
  beforeLoad: async () => {
    await requireAuth();
  },
  validateSearch: (search: Record<string, unknown>) => {
    return {
      year: search.year ? Number(search.year) : undefined,
    };
  },
});

function ResultsPage() {
  const { year: searchYear } = Route.useSearch();
  const { _ } = useLingui();
  const { toast } = useToast();
  const { isAdmin, isModerator } = useAuthContext();
  const [years, setYears] = useState<RankingYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(
    searchYear || null
  );
  const [selectedScheme, setSelectedScheme] = useState<RankingScheme>("damped");
  const [results, setResults] = useState<RankingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  // Category filtering state
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryPresets, setCategoryPresets] = useState<CategoryPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  // Preset management dialog state
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<CategoryPreset | null>(
    null
  );
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetCategories, setNewPresetCategories] = useState<string[]>([]);
  const [savingPreset, setSavingPreset] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);
  const [categoryFilterDialogOpen, setCategoryFilterDialogOpen] =
    useState(false);

  useEffect(() => {
    loadYears();
    loadCategoryPresets();
  }, [isAdmin, isModerator]);

  useEffect(() => {
    if (selectedYear) {
      calculateResults();
    }
  }, [selectedYear, selectedScheme]);

  // Filter results based on selected categories
  const filteredResults = useMemo(() => {
    if (selectedCategories.length === 0) {
      return results;
    }
    return results.filter((result) =>
      result.game.categories.some((cat) => selectedCategories.includes(cat))
    );
  }, [results, selectedCategories]);

  async function loadYears() {
    setLoading(true);
    try {
      let query = supabase
        .from("ranking_years")
        .select("*")
        .order("year", { ascending: false });

      // Regular users can only see published (public) results
      // Admins and moderators can see all years
      if (!isAdmin && !isModerator) {
        query = query.eq("is_public", true);
      }

      const { data, error } = await query;

      if (error) throw error;

      setYears(data || []);
      if (data && data.length > 0 && !selectedYear) {
        setSelectedYear(data[0].year);
      }
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

  async function calculateResults() {
    if (!selectedYear) return;

    setCalculating(true);
    try {
      // Load all users
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("*");

      if (usersError) throw usersError;

      // Load all rankings for the year
      const { data: rankings, error: rankingsError } = await supabase
        .from("user_game_rankings")
        .select("*")
        .eq("year", selectedYear);

      if (rankingsError) throw rankingsError;

      // Get unique game IDs
      const gameIds = Array.from(
        new Set(rankings?.map((r) => r.board_game_id) || [])
      );

      // Load game details
      const { data: games, error: gamesError } = await supabase
        .from("board_games")
        .select("*")
        .in("id", gameIds);

      if (gamesError) throw gamesError;

      // Calculate rankings
      const calculated = calculateRankings(
        users as User[],
        games as BoardGame[],
        rankings as UserGameRanking[],
        selectedScheme
      );

      setResults(calculated);

      // Extract unique categories from all games
      const allCategories = new Set<string>();
      for (const game of games as BoardGame[]) {
        for (const category of game.categories) {
          allCategories.add(category);
        }
      }
      setAvailableCategories(Array.from(allCategories).sort());
    } catch (error: any) {
      toast({
        title: _(t`Error calculating results`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCalculating(false);
    }
  }

  async function loadCategoryPresets() {
    try {
      const { data, error } = await supabase
        .from("category_presets")
        .select("*")
        .order("name");

      if (error) throw error;
      setCategoryPresets(data || []);
    } catch (error: any) {
      // Silently fail if table doesn't exist yet
      console.error("Failed to load category presets:", error);
    }
  }

  async function savePreset() {
    if (!newPresetName.trim() || newPresetCategories.length === 0) {
      toast({
        title: _(t`Invalid preset`),
        description: _(
          t`Please provide a name and select at least one category`
        ),
        variant: "destructive",
      });
      return;
    }

    setSavingPreset(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      if (editingPreset) {
        // Update existing preset
        const { error } = await supabase
          .from("category_presets")
          .update({
            name: newPresetName.trim(),
            categories: newPresetCategories,
          })
          .eq("id", editingPreset.id);

        if (error) throw error;

        toast({
          title: _(t`Preset updated`),
          description: _(t`Category preset has been updated successfully`),
        });
      } else {
        // Create new preset
        const { error } = await supabase.from("category_presets").insert({
          name: newPresetName.trim(),
          categories: newPresetCategories,
          created_by: userData.user.id,
          is_public: true,
        });

        if (error) throw error;

        toast({
          title: _(t`Preset saved`),
          description: _(t`Category preset has been created successfully`),
        });
      }

      setPresetDialogOpen(false);
      setNewPresetName("");
      setNewPresetCategories([]);
      setEditingPreset(null);
      await loadCategoryPresets();
      // Reopen filter dialog to continue managing presets
      setCategoryFilterDialogOpen(true);
    } catch (error: any) {
      toast({
        title: _(t`Error saving preset`),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingPreset(false);
    }
  }

  function openEditPreset(preset: CategoryPreset) {
    setEditingPreset(preset);
    setNewPresetName(preset.name);
    setNewPresetCategories([...preset.categories]);
    setPresetDialogOpen(true);
  }

  function confirmDeletePreset(presetId: string) {
    setPresetToDelete(presetId);
    setDeleteConfirmOpen(true);
  }

  async function deletePreset() {
    if (!presetToDelete) return;

    try {
      const { error } = await supabase
        .from("category_presets")
        .delete()
        .eq("id", presetToDelete);

      if (error) throw error;

      toast({
        title: _(t`Preset deleted`),
        description: _(t`Category preset has been deleted`),
      });

      if (selectedPreset === presetToDelete) {
        setSelectedPreset("");
        setSelectedCategories([]);
      }

      setDeleteConfirmOpen(false);
      setPresetToDelete(null);
      await loadCategoryPresets();
      // Reopen filter dialog to continue managing presets
      setCategoryFilterDialogOpen(true);
    } catch (error: any) {
      toast({
        title: _(t`Error deleting preset`),
        description: error.message,
        variant: "destructive",
      });
    }
  }

  function handlePresetChange(presetId: string) {
    if (presetId === "none") {
      setSelectedPreset("");
      setSelectedCategories([]);
    } else {
      setSelectedPreset(presetId);
      const preset = categoryPresets.find((p) => p.id === presetId);
      if (preset) {
        setSelectedCategories(preset.categories);
      }
    }
  }

  function toggleCategory(category: string) {
    setSelectedPreset(""); // Clear preset when manually selecting
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  }

  function clearCategoryFilter() {
    setSelectedPreset("");
    setSelectedCategories([]);
  }

  function toggleNewPresetCategory(category: string) {
    setNewPresetCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
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

  if (years.length === 0) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4 text-center">
              <p className="text-muted-foreground">
                <Trans>No public results available yet</Trans>
              </p>
              <p className="text-sm text-muted-foreground">
                <Trans>
                  Results will appear here once an admin publishes them
                </Trans>
              </p>
            </div>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            <Trans>Ranking Results</Trans>
          </h1>
          <p className="text-muted-foreground">
            <Trans>View calculated game rankings based on player votes</Trans>
          </p>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block mb-2 text-sm font-medium">
              <Trans>Year</Trans>
            </label>
            <Select
              value={selectedYear?.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.id} value={year.year.toString()}>
                    {year.year}
                    {!year.is_public && (isAdmin || isModerator) && (
                      <span className="ml-2 text-xs text-destructive">
                        (<Trans>Not Published</Trans>)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="flex items-center gap-1 mb-2 text-sm font-medium">
              <Trans>Ranking Scheme</Trans>
              <ResponsiveTooltip
                content={
                  <div className="space-y-2 max-w-xs">
                    <div>
                      <strong><Trans>Equal per Player:</Trans></strong>{" "}
                      <Trans>
                        Each player has equal voting weight (w_p = 1). Best for giving everyone an equal voice regardless of participation.
                      </Trans>
                    </div>
                    <div>
                      <strong><Trans>Damped (Recommended):</Trans></strong>{" "}
                      <Trans>
                        Player weight is square root of games played (w_p = √np). Recommended compromise that values experience while not overpowering casual voters.
                      </Trans>
                    </div>
                    <div>
                      <strong><Trans>Linear by Experience:</Trans></strong>{" "}
                      <Trans>
                        Player weight proportional to games played (w_p = np). Gives more weight to players who participated more throughout the year.
                      </Trans>
                    </div>
                  </div>
                }
                contentClassName="text-left"
              >
                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
              </ResponsiveTooltip>
            </label>
            <Select
              value={selectedScheme}
              onValueChange={(value) =>
                setSelectedScheme(value as RankingScheme)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">
                  <Trans>Equal per Player</Trans>
                </SelectItem>
                <SelectItem value="damped">
                  <Trans>Damped (Recommended)</Trans>
                </SelectItem>
                <SelectItem value="linear">
                  <Trans>Linear by Experience</Trans>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="block mb-2 text-sm font-medium">
              <Trans>Category</Trans>
            </label>
            <div className="flex gap-2">
              <Select
                value={selectedPreset || "none"}
                onValueChange={handlePresetChange}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={_(t`All Categories`)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <Trans>All Categories</Trans>
                  </SelectItem>
                  {categoryPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name} ({preset.categories.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCategoryFilterDialogOpen(true)}
                className={
                  selectedCategories.length > 0 ? "border-primary" : ""
                }
              >
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Selected Categories Summary */}
        {selectedCategories.length > 0 && (
          <div className="p-3 rounded-md bg-secondary">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">
                <Trans>
                  Filtering by {selectedCategories.length} categories
                </Trans>
              </p>
              <Button variant="ghost" size="sm" onClick={clearCategoryFilter}>
                <X className="w-4 h-4 mr-2" />
                <Trans>Clear</Trans>
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedCategories.map((cat) => (
                <Badge key={cat} variant="secondary" className="text-xs">
                  {cat}
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              <Trans>
                Showing {filteredResults.length} of {results.length} games
              </Trans>
            </p>
          </div>
        )}

        {/* Category Filter Dialog */}
        <Dialog
          open={categoryFilterDialogOpen}
          onOpenChange={setCategoryFilterDialogOpen}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                <Trans>Filter by Categories</Trans>
              </DialogTitle>
              <DialogDescription>
                <Trans>
                  Select categories to filter results. Games matching at least
                  one selected category will be shown.
                </Trans>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Preset selector with management actions */}
              <div className="space-y-2">
                <Label>
                  <Trans>Preset</Trans>
                </Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedPreset || "none"}
                    onValueChange={handlePresetChange}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={_(t`All Categories`)} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <Trans>All Categories</Trans>
                      </SelectItem>
                      {categoryPresets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name} ({preset.categories.length})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(isAdmin || isModerator) && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setCategoryFilterDialogOpen(false);
                          setPresetDialogOpen(true);
                        }}
                        title={_(t`Create Preset`)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      {selectedPreset && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              const preset = categoryPresets.find(
                                (p) => p.id === selectedPreset
                              );
                              if (preset) {
                                setCategoryFilterDialogOpen(false);
                                openEditPreset(preset);
                              }
                            }}
                            title={_(t`Edit Preset`)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => confirmDeletePreset(selectedPreset)}
                            title={_(t`Delete Preset`)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Available Categories */}
              <div className="space-y-2">
                <Label>
                  <Trans>Available Categories</Trans>
                </Label>
                <div className="flex flex-wrap gap-2 p-3 overflow-y-auto border rounded-md max-h-60">
                  {availableCategories.map((category) => (
                    <Badge
                      key={category}
                      variant={
                        selectedCategories.includes(category)
                          ? "default"
                          : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() => toggleCategory(category)}
                    >
                      {category}
                      {selectedCategories.includes(category) && (
                        <X className="w-3 h-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>

              {selectedCategories.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  <Trans>
                    {selectedCategories.length} categories selected - showing{" "}
                    {filteredResults.length} of {results.length} games
                  </Trans>
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={clearCategoryFilter}>
                <Trans>Clear All</Trans>
              </Button>
              <Button onClick={() => setCategoryFilterDialogOpen(false)}>
                <Trans>Done</Trans>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preset Create/Edit Dialog */}
        <Dialog
          open={presetDialogOpen}
          onOpenChange={(open) => {
            setPresetDialogOpen(open);
            if (!open) {
              setEditingPreset(null);
              setNewPresetName("");
              setNewPresetCategories([]);
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPreset ? (
                  <Trans>Edit Category Preset</Trans>
                ) : (
                  <Trans>Create Category Preset</Trans>
                )}
              </DialogTitle>
              <DialogDescription>
                <Trans>
                  Save a group of categories as a preset for quick filtering
                </Trans>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="preset-name">
                  <Trans>Preset Name</Trans>
                </Label>
                <Input
                  id="preset-name"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder={_(t`e.g., Strategy Games, Family Favorites`)}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  <Trans>Categories in Current Year</Trans>
                </Label>
                <div className="flex flex-wrap gap-2 p-3 overflow-y-auto border rounded-md max-h-40">
                  {availableCategories.map((category) => (
                    <Badge
                      key={category}
                      variant={
                        newPresetCategories.includes(category)
                          ? "default"
                          : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() => toggleNewPresetCategory(category)}
                    >
                      {category}
                      {newPresetCategories.includes(category) && (
                        <X className="w-3 h-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Show other categories not in current year */}
              {GAME_CATEGORIES.filter(
                (cat) => !availableCategories.includes(cat)
              ).length > 0 && (
                <div className="space-y-2">
                  <Label>
                    <Trans>Other Categories</Trans>
                  </Label>
                  <div className="flex flex-wrap gap-2 p-3 overflow-y-auto border border-dashed rounded-md max-h-40 bg-muted/50">
                    {GAME_CATEGORIES.filter(
                      (cat) => !availableCategories.includes(cat)
                    ).map((category) => (
                      <Badge
                        key={category}
                        variant={
                          newPresetCategories.includes(category)
                            ? "default"
                            : "outline"
                        }
                        className="cursor-pointer"
                        onClick={() => toggleNewPresetCategory(category)}
                      >
                        {category}
                        {newPresetCategories.includes(category) && (
                          <X className="w-3 h-3 ml-1" />
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {newPresetCategories.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <Trans>
                    {newPresetCategories.length} categories selected
                  </Trans>
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setPresetDialogOpen(false);
                  setNewPresetName("");
                  setNewPresetCategories([]);
                  setEditingPreset(null);
                  // Return to filter dialog
                  setCategoryFilterDialogOpen(true);
                }}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button onClick={savePreset} disabled={savingPreset}>
                <Save className="w-4 h-4 mr-2" />
                {savingPreset ? (
                  <Trans>Saving...</Trans>
                ) : editingPreset ? (
                  <Trans>Update Preset</Trans>
                ) : (
                  <Trans>Save Preset</Trans>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <Trans>Delete Preset</Trans>
              </DialogTitle>
              <DialogDescription>
                <Trans>
                  Are you sure you want to delete this category preset? This
                  action cannot be undone.
                </Trans>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setPresetToDelete(null);
                }}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button variant="destructive" onClick={deletePreset}>
                <Trash2 className="w-4 h-4 mr-2" />
                <Trans>Delete</Trans>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {calculating ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                <Trans>Calculating rankings...</Trans>
              </p>
            </CardContent>
          </Card>
        ) : filteredResults.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                {selectedCategories.length > 0 ? (
                  <Trans>No games match the selected categories</Trans>
                ) : (
                  <Trans>No rankings data available for this year</Trans>
                )}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredResults.map((result, index) => (
              <Card
                key={result.game.id}
                className={index < 3 ? "border-primary" : ""}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-12 h-12 text-lg font-bold rounded-full bg-primary text-primary-foreground">
                      {index + 1}
                    </div>
                    {result.game.image_url && (
                      <div className="w-20 h-20 overflow-hidden rounded bg-muted shrink-0">
                        <img
                          src={result.game.image_url}
                          alt={result.game.name}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-xl">
                        {result.game.name}
                      </CardTitle>
                      <CardDescription>
                        {result.game.year_published && (
                          <span>
                            <Trans>Year: {result.game.year_published}</Trans>
                          </span>
                        )}
                        {result.tieBreakInfo && (
                          <>
                            {" • "}
                            <span>
                              <Trans>
                                {result.tieBreakInfo.firstPlaceVotes}{" "}
                                first-place votes
                              </Trans>
                            </span>
                          </>
                        )}
                      </CardDescription>
                      {result.game.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {result.game.categories.map((cat) => (
                            <Badge
                              key={cat}
                              variant={
                                selectedCategories.includes(cat)
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {result.normalizedScore.toFixed(4)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <Trans>Score</Trans>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div>
                    <p className="mb-3 text-sm font-medium">
                      <Trans>Player Rankings:</Trans>
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {result.playerContributions.map((contrib) => (
                        <div
                          key={contrib.user.id}
                          className="flex items-center justify-between p-2 rounded bg-secondary"
                        >
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              nickname={contrib.user.nickname}
                              avatarUrl={contrib.user.avatar_url}
                              size="sm"
                              showFallback={false}
                            />
                            <span className="font-medium">
                              {contrib.user.nickname}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              (#{contrib.rank})
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {contrib.contribution.toFixed(4)}
                          </span>
                        </div>
                      ))}
                    </div>
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
