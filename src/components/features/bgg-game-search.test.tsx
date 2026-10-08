// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { BGGGameSearch } from "./bgg-game-search";
import { BGGMetadataRefresh } from "./bgg-metadata-refresh";
import { getBGGMetadata } from "@/services/bgg-metadata";
import { BGGError } from "@/services/bgg-contract";
import { messages as csMessages } from "@/locales/cs.po";

const game = {
  id: 174430,
  name: "Gloomhaven",
  alternateNames: ["Gloomhaven CZ"],
  yearPublished: 2017,
  imageUrl: "https://cf.geekdo-images.com/game.jpg",
  categories: ["Adventure"],
  publishers: ["Cephalofair Games"],
  rank: 4,
  rating: 8.6,
};
const api = vi.hoisted(() => ({
  fetchBGGGame: vi.fn(),
  searchBGGGames: vi.fn(),
  findExistingBGGGame: vi.fn(),
}));
vi.mock("@/services/bgg-api", () => api);
vi.mock("@/services/bgg-library", () => ({
  findExistingBGGGame: api.findExistingBGGGame,
}));
i18n.load("en", {});
i18n.activate("en");
function view(component: React.ReactNode) {
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  i18n.activate("en");
});

describe("BGG search and import", () => {
  it("renders Czech search and error messages with their diacritics", async () => {
    i18n.load("cs", csMessages);
    i18n.activate("cs");
    api.searchBGGGames.mockRejectedValue(new BGGError("UNAUTHORIZED"));
    const user = userEvent.setup();
    view(<BGGGameSearch onGameSelected={vi.fn()} />);
    await user.type(
      screen.getByRole("textbox", { name: "Název hry, BGG ID nebo URL" }),
      "Wingspan",
    );
    await user.click(screen.getByRole("button", { name: "Hledat" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Vaše přihlášení vypršelo. Pro použití BGG se přihlaste znovu.",
    );
  });
  it("searches by name, previews a selected result, and imports full metadata", async () => {
    api.searchBGGGames.mockResolvedValue([
      { id: 174430, name: "Gloomhaven", yearPublished: 2017 },
    ]);
    api.fetchBGGGame.mockResolvedValue(game);
    api.findExistingBGGGame.mockResolvedValue(null);
    const selected = vi.fn();
    const user = userEvent.setup();
    view(<BGGGameSearch onGameSelected={selected} />);
    await user.type(screen.getByRole("textbox"), "Gloomhaven");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(
      await screen.findByRole("button", { name: /Gloomhaven.*2017/ }),
    );
    expect(await screen.findByText("Rating: 8.6/10")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Use This Game" }));
    expect(selected).toHaveBeenCalledWith(game);
  });
  it("accepts BGG URLs and prevents duplicate imports while linking the existing game", async () => {
    api.fetchBGGGame.mockResolvedValue(game);
    api.findExistingBGGGame.mockResolvedValue({
      id: "existing-game",
      name: "Moje hra",
    });
    const user = userEvent.setup();
    view(<BGGGameSearch onGameSelected={vi.fn()} />);
    await user.type(
      screen.getByRole("textbox"),
      "https://boardgamegeek.com/boardgame/174430/gloomhaven",
    );
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(
      (await screen.findByRole("link", { name: /Moje hra/ })).getAttribute(
        "href",
      ),
    ).toBe("/games/edit/existing-game");
    expect(
      (
        screen.getByRole("button", {
          name: "Use This Game",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(api.fetchBGGGame).toHaveBeenCalledWith(174430);
  });
  it("shows empty results and actionable configuration errors", async () => {
    api.searchBGGGames
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new BGGError("NOT_CONFIGURED"));
    const user = userEvent.setup();
    view(<BGGGameSearch onGameSelected={vi.fn()} />);
    await user.type(screen.getByRole("textbox"), "Unknown");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(
      await screen.findByText(
        "No BGG games found. Try another name or a BGG ID.",
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "BGG access is not configured",
    );
  });
  it("ignores outdated results after the user changes the search", async () => {
    let resolve!: (value: unknown) => void;
    api.searchBGGGames.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const user = userEvent.setup();
    view(<BGGGameSearch onGameSelected={vi.fn()} />);
    await user.type(screen.getByRole("textbox"), "Old name");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "New name");
    resolve([{ id: 1, name: "Old result", yearPublished: 2020 }]);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Old result/ })).toBeNull(),
    );
  });
});

describe("metadata refresh preview", () => {
  it("keeps a custom name and image unchecked and applies only chosen changes", async () => {
    api.fetchBGGGame.mockResolvedValue(game);
    const onApply = vi.fn();
    const user = userEvent.setup();
    const current = {
      ...getBGGMetadata(game),
      name: "Moje hra",
      image_url: "https://local.test/image.jpg",
      bgg_rating: 8.1,
      bgg_rank: 10,
    };
    view(
      <BGGMetadataRefresh bggId="174430" current={current} onApply={onApply} />,
    );
    await user.click(screen.getByRole("button", { name: "Refresh from BGG" }));
    const name = (await screen.findByRole("checkbox", {
      name: /Primary Name/,
    })) as HTMLInputElement;
    expect(name.checked).toBe(false);
    expect(
      (screen.getByRole("checkbox", { name: /Game Image/ }) as HTMLInputElement)
        .checked,
    ).toBe(false);
    await user.click(screen.getByRole("checkbox", { name: /BGG Rank/ }));
    await user.click(
      screen.getByRole("button", { name: "Apply Selected Changes" }),
    );
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Moje hra",
        image_url: "https://local.test/image.jpg",
        bgg_rank: 10,
        bgg_rating: 8.6,
      }),
      ["bgg_rating"],
    );
    expect(api.fetchBGGGame).toHaveBeenCalledWith(174430, { refresh: true });
  });
  it("leaves changes unapplied when cancelled", async () => {
    api.fetchBGGGame.mockResolvedValue(game);
    const onApply = vi.fn();
    const user = userEvent.setup();
    view(
      <BGGMetadataRefresh
        bggId="174430"
        current={{ ...getBGGMetadata(game), bgg_rating: 7 }}
        onApply={onApply}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Refresh from BGG" }));
    await user.click(
      await screen.findByRole("button", { name: "Discard BGG Changes" }),
    );
    expect(
      screen.queryByRole("button", { name: "Apply Selected Changes" }),
    ).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
  });
});
