import { describe, expect, it } from "vitest";
import {
  parseBGGLookup,
  getBGGMetadata,
  buildBGGChanges,
  applyBGGChanges,
} from "./bgg-metadata";

export const game = {
  id: 174430,
  name: "Gloomhaven",
  alternateNames: ["Gloomhaven CZ"],
  yearPublished: 2017,
  imageUrl: "https://cf.geekdo-images.com/game.jpg",
  categories: ["Adventure", "New BGG Category"],
  publishers: ["Cephalofair Games"],
  rank: 4,
  rating: 8.6,
};

describe("BGG lookup input", () => {
  it.each([
    ["174430", { kind: "game", id: 174430 }],
    [
      " https://boardgamegeek.com/boardgame/174430/gloomhaven ",
      { kind: "game", id: 174430 },
    ],
    [
      "https://www.boardgamegeek.com/boardgameexpansion/99/example",
      { kind: "game", id: 99 },
    ],
    [" Wingspan ", { kind: "search", query: "Wingspan" }],
  ])("recognizes %s", (input, expected) =>
    expect(parseBGGLookup(input)).toEqual(expected),
  );
  it.each([
    "",
    "0",
    "-1",
    "https://evil.test/boardgame/174430",
    "https://boardgamegeek.com/boardgame/0",
    "x".repeat(201),
  ])("rejects invalid input %s", (input) => {
    expect(() => parseBGGLookup(input)).toThrow();
  });
});

describe("BGG metadata persistence and refresh", () => {
  it("matches database rating precision so an unchanged rating is not offered on every refresh", () => {
    expect(getBGGMetadata({ ...game, rating: 7.993 }).bgg_rating).toBe(7.99);
    expect(
      buildBGGChanges(
        { ...getBGGMetadata(game), bgg_rating: 7.99 },
        { ...game, rating: 7.993 },
      ),
    ).toEqual([]);
  });
  it("persists rating, rank, and categories absent from the local presets", () => {
    expect(getBGGMetadata(game)).toEqual({
      name: "Gloomhaven",
      alternate_names: ["Gloomhaven CZ"],
      year_published: 2017,
      image_url: "https://cf.geekdo-images.com/game.jpg",
      categories: ["Adventure", "New BGG Category"],
      publishers: ["Cephalofair Games"],
      bgg_rank: 4,
      bgg_rating: 8.6,
    });
  });
  it("applies only selected changes and retains local names, images, and classification", () => {
    const current = {
      ...getBGGMetadata(game),
      name: "Moje hra",
      image_url: "https://local.test/custom.jpg",
      bgg_rank: 12,
      bgg_rating: 8.1,
      game_type: "strategy",
    };
    const changes = buildBGGChanges(current, game);
    expect(changes.map((change) => change.field)).toEqual([
      "name",
      "image_url",
      "bgg_rank",
      "bgg_rating",
    ]);
    expect(changes.find((change) => change.field === "name")?.selected).toBe(
      false,
    );
    expect(
      changes.find((change) => change.field === "image_url")?.selected,
    ).toBe(false);
    const updated = applyBGGChanges(
      current,
      changes.filter((change) => change.field === "bgg_rating"),
    );
    expect(updated).toMatchObject({
      name: "Moje hra",
      image_url: "https://local.test/custom.jpg",
      bgg_rank: 12,
      bgg_rating: 8.6,
      game_type: "strategy",
    });
    expect(current.bgg_rating).toBe(8.1);
  });
  it("does not offer missing upstream values as destructive replacements", () => {
    const current = getBGGMetadata(game);
    expect(
      buildBGGChanges(current, {
        ...game,
        imageUrl: null,
        rank: null,
        rating: null,
        categories: [],
        alternateNames: [],
        publishers: [],
        yearPublished: null,
      }),
    ).toEqual([]);
  });
});
