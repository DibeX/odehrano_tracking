import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import {
  applyGameMetadata,
  toGameMetadata,
  toBoardGameWrite,
  type GameFormData,
} from "@/services/game-metadata";
import { BGGMetadataRefresh } from "@/components/features/bgg-metadata-refresh";
import { BGGStats } from "@/components/features/bgg-game-preview";
import { BGGError } from "@/services/bgg-contract";
import { getBGGErrorMessage } from "@/services/bgg-messages";

import { useToast } from "@/hooks/use-toast";
import { requireRole } from "@/lib/auth-helpers";
import { BGGGameSearch } from "@/components/features/bgg-game-search";
import { getBGGMetadata } from "@/services/bgg-metadata";
import { GAME_CATEGORIES } from "@/constants/game-categories";
import {
  BOARD_GAME_TYPES,
  type BoardGameType,
  getBoardGameTypeLabel,
} from "@/constants/board-game-types";
import type { BGGGameInfo } from "@/types";
import { Plus, X, Download, Upload } from "lucide-react";

export const Route = createFileRoute("/games/new")({
  beforeLoad: async () => {
    await requireRole("moderator");
  },
  component: NewGamePage,
});

type InputMode = "bgg" | "manual";

function NewGamePage() {
  const { _ } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [inputMode, setInputMode] = useState<InputMode>("bgg");
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<GameFormData>({
    primaryName: "",
    alternateNames: [],
    yearPublished: "",
    publishers: [],
    categories: [],
    gameType: null,
    bggId: "",
    imageUrl: "",
    bggRank: null,
    bggRating: null,
  });

  const [newAlternateName, setNewAlternateName] = useState("");
  const [newPublisher, setNewPublisher] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  function handleBGGImport(gameInfo: BGGGameInfo) {
    setFormData((prev) => ({
      ...applyGameMetadata(prev, getBGGMetadata(gameInfo)),
      bggId: gameInfo.id.toString(),
    }));
    setImageFile(null);
    setImagePreview("");
    toast({
      title: _(t`Game loaded`),
      description: _(
        t`Game data imported from BoardGameGeek. You can edit any fields before saving.`,
      ),
    });
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

  function handleToggleCategory(category: string) {
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

    setLoading(true);

    try {
      const payload = toBoardGameWrite(formData);
      // Check if game with same BGG ID already exists (if BGG ID is provided)
      if (formData.bggId) {
        const { data: existingGame, error: duplicateError } = (await supabase
          .from("board_games")
          .select("id, name")
          .eq("bgg_id", payload.bgg_id!)
          .maybeSingle()) as {
          data: { id: string; name: string } | null;
          error: unknown;
        };

        if (duplicateError) throw duplicateError;

        if (existingGame) {
          toast({
            title: _(t`Game already exists`),
            description: _(
              t`A game with BGG ID ${formData.bggId} already exists: ${existingGame.name}`,
            ),
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      let finalImageUrl = formData.imageUrl || null;

      // Upload image if a file was selected
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

      // Insert the new game
      const { data: newGame, error } = await supabase
        .from("board_games")
        .insert({ ...payload, image_url: finalImageUrl })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: _(t`Game added`),
        description: _(
          t`${formData.primaryName} has been added to the database`,
        ),
      });

      navigate({ to: "/games/library" });
    } catch (error: any) {
      console.error("Error adding game:", error);
      toast({
        title: _(t`Error adding game`),
        description:
          error instanceof BGGError
            ? getBGGErrorMessage(error, _)
            : error.code === "23505"
              ? _(
                  t`A game with this BGG ID is already in your library. Search the library before adding it again.`,
                )
              : error.message || _(t`Failed to add game to database`),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      primaryName: "",
      alternateNames: [],
      yearPublished: "",
      publishers: [],
      categories: [],
      gameType: null,
      bggId: "",
      imageUrl: "",
      bggRank: null,
      bggRating: null,
    });
    setNewAlternateName("");
    setNewPublisher("");
    setImageFile(null);
    setImagePreview("");
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            <Trans>Add Board Game</Trans>
          </h1>
          <p className="mt-2 text-muted-foreground">
            <Trans>
              Add a new board game to the database by entering details manually
              or importing from BoardGameGeek.
            </Trans>
          </p>
        </div>

        {/* Input Mode Selection */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Input Method</Trans>
            </CardTitle>
            <CardDescription>
              <Trans>Choose how you want to add the game</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                type="button"
                variant={inputMode === "manual" ? "default" : "outline"}
                onClick={() => setInputMode("manual")}
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-2" />
                <Trans>Manual Entry</Trans>
              </Button>
              <Button
                type="button"
                variant={inputMode === "bgg" ? "default" : "outline"}
                onClick={() => setInputMode("bgg")}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                <Trans>Import from BGG</Trans>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* BGG Import Section */}
        {inputMode === "bgg" && (
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Import from BoardGameGeek</Trans>
              </CardTitle>
              <CardDescription>
                <Trans>
                  Find a game and preview its metadata before importing.
                </Trans>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BGGGameSearch
                onGameSelected={handleBGGImport}
                disabled={loading}
              />
            </CardContent>
          </Card>
        )}

        <BGGStats rank={formData.bggRank} rating={formData.bggRating} />
        {/* Game Details Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Game Details</Trans>
              </CardTitle>
              <CardDescription>
                {inputMode === "bgg" ? (
                  <Trans>Review and edit the imported game information</Trans>
                ) : (
                  <Trans>Enter the game details manually</Trans>
                )}
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
                  min="-5000"
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
                  {[
                    ...new Set([...GAME_CATEGORIES, ...formData.categories]),
                  ].map((category) => (
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
                    setFormData((prev) => ({
                      ...prev,
                      bggId: e.target.value,
                      bggRank:
                        e.target.value === prev.bggId ? prev.bggRank : null,
                      bggRating:
                        e.target.value === prev.bggId ? prev.bggRating : null,
                    }))
                  }
                  placeholder={_(t`Optional - BGG game ID`)}
                />
                <p className="text-xs text-muted-foreground">
                  <Trans>
                    Optional. Links this game to its BoardGameGeek entry.
                  </Trans>
                </p>
              </div>

              {formData.bggId && (
                <BGGMetadataRefresh
                  bggId={formData.bggId}
                  current={{
                    ...toGameMetadata(formData),
                    image_url: imagePreview || formData.imageUrl || null,
                  }}
                  disabled={loading}
                  onApply={(metadata, fields) => {
                    setFormData((prev) =>
                      applyGameMetadata(prev, metadata, fields),
                    );
                    if (fields.includes("image_url")) {
                      setImageFile(null);
                      setImagePreview("");
                    }
                  }}
                />
              )}

              {/* Game Image Upload */}
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
                  disabled={loading || !formData.primaryName.trim()}
                >
                  {loading ? <Trans>Adding...</Trans> : <Trans>Add Game</Trans>}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  <Trans>Reset</Trans>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate({ to: "/games" })}
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
