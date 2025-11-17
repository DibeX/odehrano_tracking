import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { requireRole } from "@/lib/auth-helpers";
import {
  GAME_CATEGORIES,
  type GameCategory,
} from "@/constants/game-categories";
import {
  BOARD_GAME_TYPES,
  type BoardGameType,
  getBoardGameTypeLabel,
} from "@/constants/board-game-types";
import type { BoardGame } from "@/types";
import { Plus, X, Upload, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/games/edit/$gameId")({
  beforeLoad: async () => {
    await requireRole("moderator");
  },
  component: EditGamePage,
});

interface GameFormData {
  primaryName: string;
  alternateNames: string[];
  yearPublished: string;
  publishers: string[];
  categories: GameCategory[];
  gameType: BoardGameType | null;
  bggId: string;
  imageUrl: string;
}

function EditGamePage() {
  const { gameId } = Route.useParams();
  const { _ } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [game, setGame] = useState<BoardGame | null>(null);

  function handleBack() {
    if (router.history.length <= 1) {
      router.navigate({ to: "/games/library" });
    } else {
      router.history.back();
    }
  }

  const [formData, setFormData] = useState<GameFormData>({
    primaryName: "",
    alternateNames: [],
    yearPublished: "",
    publishers: [],
    categories: [],
    gameType: null,
    bggId: "",
    imageUrl: "",
  });

  const [newAlternateName, setNewAlternateName] = useState("");
  const [newPublisher, setNewPublisher] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  useEffect(() => {
    loadGame();
  }, [gameId]);

  async function loadGame() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("board_games")
        .select("*")
        .eq("id", gameId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          title: _(t`Game not found`),
          description: _(t`The game you are trying to edit does not exist`),
          variant: "destructive",
        });
        navigate({ to: "/games/library" });
        return;
      }

      setGame(data);
      setFormData({
        primaryName: data.name,
        alternateNames: data.alternate_names || [],
        yearPublished: data.year_published?.toString() || "",
        publishers: data.publishers || [],
        categories: (data.categories || []) as GameCategory[],
        gameType: (data.game_type as BoardGameType) || null,
        bggId: data.bgg_id?.toString() || "",
        imageUrl: data.image_url || "",
      });
    } catch (error: any) {
      toast({
        title: _(t`Error loading game`),
        description: error.message,
        variant: "destructive",
      });
      navigate({ to: "/games/library" });
    } finally {
      setLoading(false);
    }
  }

  function handleAddAlternateName() {
    if (
      newAlternateName.trim() &&
      !formData.alternateNames.includes(newAlternateName.trim())
    ) {
      setFormData((prev) => ({
        ...prev,
        alternateNames: [...prev.alternateNames, newAlternateName.trim()],
      }));
      setNewAlternateName("");
    }
  }

  function handleRemoveAlternateName(name: string) {
    setFormData((prev) => ({
      ...prev,
      alternateNames: prev.alternateNames.filter((n) => n !== name),
    }));
  }

  function handleAddPublisher() {
    if (
      newPublisher.trim() &&
      !formData.publishers.includes(newPublisher.trim())
    ) {
      setFormData((prev) => ({
        ...prev,
        publishers: [...prev.publishers, newPublisher.trim()],
      }));
      setNewPublisher("");
    }
  }

  function handleRemovePublisher(publisher: string) {
    setFormData((prev) => ({
      ...prev,
      publishers: prev.publishers.filter((p) => p !== publisher),
    }));
  }

  function handleToggleCategory(category: GameCategory) {
    setFormData((prev) => {
      if (prev.categories.includes(category)) {
        return {
          ...prev,
          categories: prev.categories.filter((c) => c !== category),
        };
      } else {
        return {
          ...prev,
          categories: [...prev.categories, category],
        };
      }
    });
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview("");
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.primaryName.trim()) {
      toast({
        title: _(t`Primary name required`),
        description: _(t`Please enter the primary name of the game`),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Check if BGG ID is already used by another game
      if (formData.bggId) {
        const { data: existingGame } = await supabase
          .from("board_games")
          .select("id, name")
          .eq("bgg_id", parseInt(formData.bggId))
          .neq("id", gameId)
          .single();

        if (existingGame) {
          toast({
            title: _(t`BGG ID already used`),
            description: _(
              t`BGG ID ${formData.bggId} is already used by: ${existingGame.name}`
            ),
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
      }

      let finalImageUrl = formData.imageUrl || null;

      // Upload new image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `game-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("game-images")
          .upload(filePath, imageFile, {
            cacheControl: "31536000", // Cache for 1 year (immutable since filename has timestamp)
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Failed to upload image: ${uploadError.message}`);
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("game-images").getPublicUrl(filePath);

        finalImageUrl = publicUrl;
      }

      // Update the game
      const { error } = await supabase
        .from("board_games")
        .update({
          bgg_id: formData.bggId ? parseInt(formData.bggId) : null,
          name: formData.primaryName.trim(),
          alternate_names: formData.alternateNames,
          year_published: formData.yearPublished
            ? parseInt(formData.yearPublished)
            : null,
          publishers: formData.publishers,
          categories: formData.categories,
          game_type: formData.gameType,
          image_url: finalImageUrl,
        })
        .eq("id", gameId);

      if (error) throw error;

      toast({
        title: _(t`Game updated`),
        description: _(t`${formData.primaryName} has been updated`),
      });

      navigate({ to: "/games/library" });
    } catch (error: any) {
      console.error("Error updating game:", error);
      toast({
        title: _(t`Error updating game`),
        description: error.message || _(t`Failed to update game`),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                <Trans>Loading game...</Trans>
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
        <div className="max-w-4xl mx-auto">
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            <Trans>Back</Trans>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              <Trans>Edit Board Game</Trans>
            </h1>
            <p className="mt-2 text-muted-foreground">
              <Trans>Update the details for {game.name}</Trans>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Game Details</Trans>
              </CardTitle>
              <CardDescription>
                <Trans>Edit the game information</Trans>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Name */}
              <div className="space-y-2">
                <Label htmlFor="primaryName">
                  <Trans>Primary Name</Trans>{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="primaryName"
                  value={formData.primaryName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      primaryName: e.target.value,
                    }))
                  }
                  placeholder={_(t`Enter the primary game name`)}
                  required
                />
              </div>

              {/* Alternate Names */}
              <div className="space-y-2">
                <Label>
                  <Trans>Alternate Names</Trans>
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={newAlternateName}
                    onChange={(e) => setNewAlternateName(e.target.value)}
                    placeholder={_(t`Add alternate name`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddAlternateName();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleAddAlternateName}
                    variant="outline"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.alternateNames.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.alternateNames.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full bg-secondary text-secondary-foreground"
                      >
                        {name}
                        <button
                          type="button"
                          onClick={() => handleRemoveAlternateName(name)}
                          className="hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Year Published */}
              <div className="space-y-2">
                <Label htmlFor="yearPublished">
                  <Trans>Year Released</Trans>
                </Label>
                <Input
                  id="yearPublished"
                  type="number"
                  value={formData.yearPublished}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      yearPublished: e.target.value,
                    }))
                  }
                  placeholder={_(t`e.g., 2017`)}
                  min="1900"
                  max={new Date().getFullYear() + 1}
                />
              </div>

              {/* Publishers */}
              <div className="space-y-2">
                <Label>
                  <Trans>Publishers</Trans>
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={newPublisher}
                    onChange={(e) => setNewPublisher(e.target.value)}
                    placeholder={_(t`Add publisher`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddPublisher();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleAddPublisher}
                    variant="outline"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.publishers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.publishers.map((publisher) => (
                      <span
                        key={publisher}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full bg-secondary text-secondary-foreground"
                      >
                        {publisher}
                        <button
                          type="button"
                          onClick={() => handleRemovePublisher(publisher)}
                          className="hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Game Type */}
              <div className="space-y-2">
                <Label>
                  <Trans>Game Type</Trans>
                </Label>
                <p className="text-xs text-muted-foreground">
                  <Trans>Select the primary game type classification</Trans>
                </p>
                <div className="p-3 space-y-1 border rounded-md">
                  <label className="flex items-center gap-2 p-1 rounded cursor-pointer hover:bg-muted">
                    <input
                      type="radio"
                      name="gameType"
                      checked={formData.gameType === null}
                      onChange={() =>
                        setFormData((prev) => ({ ...prev, gameType: null }))
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-muted-foreground">
                      <Trans>Not specified</Trans>
                    </span>
                  </label>
                  {BOARD_GAME_TYPES.map((type) => (
                    <label
                      key={type}
                      className="flex items-center gap-2 p-1 rounded cursor-pointer hover:bg-muted"
                    >
                      <input
                        type="radio"
                        name="gameType"
                        checked={formData.gameType === type}
                        onChange={() =>
                          setFormData((prev) => ({ ...prev, gameType: type }))
                        }
                        className="rounded"
                      />
                      <span className="text-sm">
                        {getBoardGameTypeLabel(type, _)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-2">
                <Label>
                  <Trans>Categories</Trans>
                </Label>
                <p className="text-xs text-muted-foreground">
                  <Trans>Select all categories that apply to this game</Trans>
                </p>
                <div className="p-3 space-y-1 overflow-y-auto border rounded-md max-h-64">
                  {GAME_CATEGORIES.map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-2 p-1 rounded cursor-pointer hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={formData.categories.includes(category)}
                        onChange={() => handleToggleCategory(category)}
                        className="rounded"
                      />
                      <span className="text-sm">{category}</span>
                    </label>
                  ))}
                </div>
                {formData.categories.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <Trans>
                      Selected: {formData.categories.length} categories
                    </Trans>
                  </div>
                )}
              </div>

              {/* BGG ID */}
              <div className="space-y-2">
                <Label htmlFor="bggId">
                  <Trans>BoardGameGeek ID</Trans>
                </Label>
                <Input
                  id="bggId"
                  type="number"
                  value={formData.bggId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, bggId: e.target.value }))
                  }
                  placeholder={_(t`Optional - BGG game ID`)}
                />
                <p className="text-xs text-muted-foreground">
                  <Trans>
                    Optional. Links this game to its BoardGameGeek entry.
                  </Trans>
                </p>
              </div>

              {/* Game Image */}
              <div className="space-y-2">
                <Label>
                  <Trans>Game Image</Trans>
                </Label>
                {(formData.imageUrl || imagePreview) && (
                  <div className="relative max-w-sm">
                    <div className="overflow-hidden rounded-lg aspect-video bg-muted">
                      <img
                        src={imagePreview || formData.imageUrl}
                        alt={formData.primaryName}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute p-1 rounded-full top-2 right-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {!formData.imageUrl && !imagePreview && (
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted">
                      <Upload className="w-4 h-4" />
                      <span className="text-sm">
                        <Trans>Upload Image</Trans>
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">
                      <Trans>Upload a game box image (JPG, PNG, WebP)</Trans>
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={saving || !formData.primaryName.trim()}
                >
                  {saving ? (
                    <Trans>Saving...</Trans>
                  ) : (
                    <Trans>Save Changes</Trans>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate({ to: "/games/library" })}
                >
                  <Trans>Cancel</Trans>
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </AppLayout>
  );
}
