import type { BoardGameType } from "@/constants/board-game-types";
import type { BGGMetadata, BGGMetadataField } from "./bgg-metadata";
import type { BoardGameInsert } from "@/types";
import { BGGError } from "./bgg-contract";
export interface GameFormData {
  primaryName: string;
  alternateNames: string[];
  yearPublished: string;
  publishers: string[];
  categories: string[];
  gameType: BoardGameType | null;
  bggId: string;
  imageUrl: string;
  bggRank: number | null;
  bggRating: number | null;
}
export function applyGameMetadata(
  form: GameFormData,
  metadata: BGGMetadata,
  fields?: BGGMetadataField[],
): GameFormData {
  const updated = {
    ...form,
    primaryName: metadata.name,
    alternateNames: metadata.alternate_names,
    yearPublished: metadata.year_published?.toString() ?? "",
    publishers: metadata.publishers,
    categories: metadata.categories,
    imageUrl: metadata.image_url ?? "",
    bggRank: metadata.bgg_rank,
    bggRating: metadata.bgg_rating,
  };
  if (!fields) return updated;
  const formFields: Record<BGGMetadataField, keyof GameFormData> = {
    name: "primaryName",
    alternate_names: "alternateNames",
    image_url: "imageUrl",
    year_published: "yearPublished",
    publishers: "publishers",
    categories: "categories",
    bgg_rank: "bggRank",
    bgg_rating: "bggRating",
  };
  return {
    ...form,
    ...Object.fromEntries(
      fields.map((field) => [formFields[field], updated[formFields[field]]]),
    ),
  };
}
export function toGameMetadata(form: GameFormData): BGGMetadata {
  return {
    name: form.primaryName.trim(),
    alternate_names: form.alternateNames,
    year_published: form.yearPublished ? Number(form.yearPublished) : null,
    publishers: form.publishers,
    categories: form.categories,
    image_url: form.imageUrl || null,
    bgg_rank: form.bggRank,
    bgg_rating: form.bggRating,
  };
}
export function toBoardGameWrite(form: GameFormData): BoardGameInsert {
  const id = form.bggId.trim();
  if (id && (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))))
    throw new BGGError("INVALID_INPUT");
  return {
    ...toGameMetadata(form),
    bgg_id: id ? Number(id) : null,
    game_type: form.gameType,
  };
}
