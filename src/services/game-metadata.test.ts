import { expect, it } from "vitest";
import {
  applyGameMetadata,
  toGameMetadata,
  toBoardGameWrite,
  type GameFormData,
} from "./game-metadata";

const form: GameFormData = {
  primaryName: " My game ",
  alternateNames: ["Local name"],
  yearPublished: "2020",
  publishers: ["Publisher"],
  categories: ["New category"],
  gameType: "strategy",
  bggId: "42",
  imageUrl: "https://local.test/box.jpg",
  bggRank: 2,
  bggRating: 10,
};
it("writes imported rating, rank, and all categories alongside the game ID", () => {
  expect(toBoardGameWrite(form)).toMatchObject({
    bgg_id: 42,
    name: "My game",
    bgg_rank: 2,
    bgg_rating: 10,
    categories: ["New category"],
    game_type: "strategy",
  });
});
it("maps refreshed metadata into editable fields without changing classification or BGG ID", () => {
  const refreshed = applyGameMetadata(form, {
    ...toGameMetadata(form),
    name: "Updated",
    bgg_rating: 8.5,
    year_published: 2021,
  });
  expect(refreshed).toMatchObject({
    primaryName: "Updated",
    bggRating: 8.5,
    yearPublished: "2021",
    gameType: "strategy",
    bggId: "42",
  });
  expect(form.primaryName).toBe(" My game ");
});
it.each(["0", "-1", "42garbage", "1.5", "9007199254740992"])(
  "rejects malformed BGG IDs at save time: %s",
  (bggId) => {
    expect(() => toBoardGameWrite({ ...form, bggId })).toThrow();
  },
);
it("supports manual games without a BGG ID", () => {
  expect(
    toBoardGameWrite({ ...form, bggId: "", bggRank: null, bggRating: null }),
  ).toMatchObject({ bgg_id: null, bgg_rank: null, bgg_rating: null });
});
it("does not copy an unselected upload preview into the saved image URL", () => {
  const incoming = {
    ...toGameMetadata(form),
    image_url: "data:image/png;base64,pending-upload",
    name: "Old preview name",
    bgg_rating: 8.5,
  };
  const updated = applyGameMetadata(form, incoming, ["bgg_rating"]);
  expect(updated).toMatchObject({
    primaryName: " My game ",
    imageUrl: "https://local.test/box.jpg",
    bggRating: 8.5,
  });
});
