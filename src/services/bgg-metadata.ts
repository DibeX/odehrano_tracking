import type { BGGGameInfo } from "@/types";
import { BGGError } from "./bgg-contract";

export function parseBGGLookup(
  input: string,
): { kind: "game"; id: number } | { kind: "search"; query: string } {
  const query = input.trim();
  if (!query || query.length > 200) throw new BGGError("INVALID_INPUT");
  let id: string | undefined;
  if (/^-?\d+$/.test(query)) id = query;
  else if (/^(https?:\/\/|www\.|boardgamegeek\.com\/)/i.test(query)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(query) ? query : `https://${query}`);
    } catch {
      throw new BGGError("INVALID_INPUT");
    }
    if (
      !["boardgamegeek.com", "www.boardgamegeek.com"].includes(url.hostname) ||
      url.username ||
      url.password
    )
      throw new BGGError("INVALID_INPUT");
    id = url.pathname.match(
      /^\/boardgame(?:expansion)?\/([1-9]\d*)(?:\/|$)/,
    )?.[1];
    if (!id) throw new BGGError("INVALID_INPUT");
  }
  if (id !== undefined) {
    const number = Number(id);
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(number))
      throw new BGGError("INVALID_INPUT");
    return { kind: "game", id: number };
  }
  if (query.length < 2) throw new BGGError("INVALID_INPUT");
  return { kind: "search", query };
}

export function getBGGMetadata(game: BGGGameInfo) {
  return {
    name: game.name,
    alternate_names: [...game.alternateNames],
    image_url: game.imageUrl,
    year_published: game.yearPublished,
    publishers: [...game.publishers],
    categories: [...game.categories],
    bgg_rank: game.rank,
    bgg_rating:
      game.rating === null ? null : Math.round(game.rating * 100) / 100,
  };
}
export type BGGMetadata = ReturnType<typeof getBGGMetadata>;
export type BGGMetadataField = keyof BGGMetadata;
export interface BGGMetadataChange {
  field: BGGMetadataField;
  before: BGGMetadata[BGGMetadataField];
  after: BGGMetadata[BGGMetadataField];
  selected: boolean;
}

export function buildBGGChanges(
  current: BGGMetadata,
  game: BGGGameInfo,
): BGGMetadataChange[] {
  const next = getBGGMetadata(game);
  return (Object.keys(next) as BGGMetadataField[]).flatMap((field) => {
    const after = next[field];
    const before = current[field];
    if (
      after === null ||
      (Array.isArray(after) && after.length === 0) ||
      JSON.stringify(before) === JSON.stringify(after)
    )
      return [];
    return [
      {
        field,
        before,
        after,
        selected: !((field === "name" || field === "image_url") && before),
      },
    ];
  });
}

/** The caller supplies the selected changes; the original object is never mutated. */
export function applyBGGChanges<T extends BGGMetadata>(
  current: T,
  selectedChanges: BGGMetadataChange[],
): T {
  return {
    ...current,
    ...Object.fromEntries(
      selectedChanges.map((change) => [change.field, change.after]),
    ),
  };
}
