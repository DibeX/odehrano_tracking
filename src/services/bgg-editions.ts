import type { BGGGameInfo } from "@/types";
import { BGGError } from "./bgg-contract";

export interface BGGEditionSelection {
  name: string;
  editionId: number | null;
}
export function getBGGNames(game: BGGGameInfo): string[] {
  return [...new Set([game.name, ...game.alternateNames])];
}
export function getCzechEditions(game: BGGGameInfo) {
  return (game.editions ?? []).filter((edition) =>
    edition.languages.some((language) => language.toLowerCase() === "czech"),
  );
}
export function defaultBGGEditionSelection(
  game: BGGGameInfo,
  current?: { name: string; publishers: string[] },
): BGGEditionSelection {
  const editions = getCzechEditions(game);
  const matching =
    current &&
    editions.find(
      (edition) =>
        edition.publishers.length > 0 &&
        JSON.stringify([...edition.publishers].sort()) ===
          JSON.stringify([...current.publishers].sort()),
    );
  return {
    name:
      current && getBGGNames(game).includes(current.name)
        ? current.name
        : game.name,
    editionId: (matching || editions[0])?.id ?? null,
  };
}
/** Edition labels are not localized titles; a title is explicitly selected from BGG names. */
export function selectBGGEdition(
  game: BGGGameInfo,
  selection: BGGEditionSelection,
): BGGGameInfo {
  if (!getBGGNames(game).includes(selection.name))
    throw new BGGError("INVALID_INPUT");
  const edition =
    selection.editionId === null
      ? null
      : (game.editions ?? []).find(
          (edition) => edition.id === selection.editionId,
        );
  if (selection.editionId !== null && !edition)
    throw new BGGError("INVALID_INPUT");
  return {
    ...game,
    name: selection.name,
    alternateNames: getBGGNames(game).filter((name) => name !== selection.name),
    // An edition with missing publisher data must not erase available metadata.
    publishers: [
      ...(edition?.publishers.length ? edition.publishers : game.publishers),
    ],
  };
}
