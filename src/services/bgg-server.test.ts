import { describe, expect, it, vi } from "vitest";
import {
  createBGGClient,
  parseBGGGame,
  parseBGGSearch,
  handleBGGRequest,
  authorizeBGGAccess,
} from "./bgg-server";

const xml = `<items><item type="boardgame" id="174430"><name type="alternate" value="Gloomhaven CZ"/><name type="primary" value="Gloomhaven &amp; Friends"/><yearpublished value="2017"/><image>https://cf.geekdo-images.com/game.jpg</image><link type="boardgamecategory" value="Adventure"/><link type="boardgamepublisher" value="Cephalofair Games"/><statistics><ratings><ranks><rank name="strategygames" value="1"/><rank name="boardgame" value="4"/></ranks><average value="8.6"/></ratings></statistics></item></items>`;
const response = (body = xml, status = 200, headers?: HeadersInit) =>
  new Response(body, { status, headers });

describe("BGG XML parsing", () => {
  it("preserves negative publication years for ancient games in details and search", () => {
    const ancient =
      '<items><item type="boardgame" id="2399"><name type="primary" value="The Royal Game of Ur"/><yearpublished value="-2200"/></item></items>';
    expect(parseBGGGame(ancient, 2399).yearPublished).toBe(-2200);
    expect(parseBGGSearch(ancient)).toEqual([
      { id: 2399, name: "The Royal Game of Ur", yearPublished: -2200 },
    ]);
  });
  it("reads primary/alternate names, metadata and the overall rank", () => {
    expect(parseBGGGame(xml, 174430)).toEqual({
      id: 174430,
      name: "Gloomhaven & Friends",
      alternateNames: ["Gloomhaven CZ"],
      yearPublished: 2017,
      imageUrl: "https://cf.geekdo-images.com/game.jpg",
      categories: ["Adventure"],
      publishers: ["Cephalofair Games"],
      rank: 4,
      rating: 8.6,
    });
  });
  it("treats missing, unrated and unranked metadata as null", () => {
    const minimal = `<items><item type="boardgameexpansion" id="99"><name type="primary" value="Expansion"/><yearpublished value="0"/><statistics><ratings><average value="N/A"/><ranks><rank name="boardgame" value="Not Ranked"/></ranks></ratings></statistics></item></items>`;
    expect(parseBGGGame(minimal, 99)).toMatchObject({
      yearPublished: null,
      imageUrl: null,
      rank: null,
      rating: null,
      categories: [],
    });
  });
  it.each([
    "<html>Login</html>",
    "<items><item",
    '<!DOCTYPE items [<!ENTITY secret "injected">]><items/>',
  ])("rejects invalid XML or unexpected responses", (input) => {
    expect(() => parseBGGGame(input, 174430)).toThrow();
  });
  it("rejects the wrong ID and non-board-game items", () => {
    expect(() => parseBGGGame(xml, 99)).toThrow();
    expect(() =>
      parseBGGGame(xml.replace('type="boardgame"', 'type="videogame"'), 174430),
    ).toThrow();
  });
  it("parses empty and multiple search results without requiring full metadata", () => {
    expect(parseBGGSearch('<items total="0"/>')).toEqual([]);
    expect(
      parseBGGSearch(
        '<items><item type="boardgame" id="1"><name value="First"/><yearpublished value="2020"/></item><item type="boardgameexpansion" id="2"><name value="Expansion"/></item></items>',
      ),
    ).toEqual([
      { id: 1, name: "First", yearPublished: 2020 },
      { id: 2, name: "Expansion", yearPublished: null },
    ]);
  });
});

describe("authenticated BGG transport, caching and retries", () => {
  it("uses the canonical BGG host and bearer token; caches and bypasses cache on refresh", async () => {
    const requests: Request[] = [];
    let time = 0;
    const client = createBGGClient({
      token: () => "private-token",
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return response();
      },
    });
    expect((await client.game(174430)).rank).toBe(4);
    await client.game(174430);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(
      "https://boardgamegeek.com/xmlapi2/thing?id=174430&stats=1",
    );
    expect(requests[0].headers.get("Authorization")).toBe(
      "Bearer private-token",
    );
    await client.game(174430, true);
    expect(requests).toHaveLength(2);
    time += 24 * 60 * 60 * 1000 + 1;
    await client.game(174430);
    expect(requests).toHaveLength(3);
  });
  it("coalesces simultaneous lookups and safely encodes search queries", async () => {
    const urls: string[] = [];
    const client = createBGGClient({
      token: () => "token",
      sleep: async () => {},
      fetch: async (input) => {
        urls.push(String(input));
        return response("<items/>");
      },
    });
    expect(
      await Promise.all([client.search("A & B"), client.search("A & B")]),
    ).toEqual([[], []]);
    expect(urls).toEqual([
      "https://boardgamegeek.com/xmlapi2/search?query=A+%26+B&type=boardgame,boardgameexpansion",
    ]);
  });
  it("retries queued and throttled responses, then returns parsed metadata", async () => {
    let attempts = 0;
    const sleep = vi.fn(async () => {});
    const client = createBGGClient({
      token: () => "token",
      sleep,
      fetch: async () => {
        attempts++;
        return attempts === 1
          ? response("", 202)
          : attempts === 2
            ? response("", 429, { "Retry-After": "1" })
            : response();
      },
    });
    expect((await client.game(174430)).name).toBe("Gloomhaven & Friends");
    expect(attempts).toBe(3);
  });
  it("stops after three unsuccessful attempts and does not cache failures", async () => {
    let attempts = 0;
    const client = createBGGClient({
      token: () => "token",
      sleep: async () => {},
      fetch: async () => {
        attempts++;
        return response("", 503);
      },
    });
    await expect(client.game(174430)).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
    expect(attempts).toBe(3);
    await expect(client.game(174430)).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
    expect(attempts).toBe(6);
  });
  it.each([401, 403])(
    "does not retry rejected credentials (%s)",
    async (status) => {
      let attempts = 0;
      const client = createBGGClient({
        token: () => "token",
        fetch: async () => {
          attempts++;
          return response("", status);
        },
      });
      await expect(client.game(174430)).rejects.toMatchObject({
        code: "BGG_AUTH",
      });
      expect(attempts).toBe(1);
    },
  );
  it("reports absent configuration without making upstream requests", async () => {
    const fetch = vi.fn();
    const client = createBGGClient({ token: () => undefined, fetch });
    await expect(client.game(174430)).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports a timed-out request without exposing the original error", async () => {
    const client = createBGGClient({
      token: () => "secret",
      sleep: async () => {},
      fetch: async () => {
        throw new DOMException("secret", "TimeoutError");
      },
    });
    await expect(client.game(174430)).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });
});

describe("server access boundary", () => {
  it.each(["admin", "moderator"])(
    "verifies the Supabase user and permits %s",
    async (role) => {
      const requests: Request[] = [];
      await authorizeBGGAccess("session-token", {
        url: "https://example.supabase.co",
        key: "public-key",
        fetch: async (input, init) => {
          const request = new Request(input, init);
          requests.push(request);
          return request.url.includes("/auth/v1/user")
            ? response(
                JSON.stringify({
                  id: "verified-user",
                  aud: "authenticated",
                  role: "authenticated",
                }),
              )
            : response(JSON.stringify({ role }));
        },
      });
      expect(requests).toHaveLength(2);
      expect(requests[0].headers.get("Authorization")).toBe(
        "Bearer session-token",
      );
      expect(requests[1].url).toContain("auth_user_id=eq.verified-user");
    },
  );
  it("denies a verified player", async () => {
    await expect(
      authorizeBGGAccess("session-token", {
        url: "https://example.supabase.co",
        key: "public-key",
        fetch: async (input) =>
          String(input).includes("/auth/v1/user")
            ? response(JSON.stringify({ id: "player", aud: "authenticated" }))
            : response(JSON.stringify({ role: "player" })),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("denies missing and invalid sessions", async () => {
    await expect(
      authorizeBGGAccess("", {
        url: "https://example.supabase.co",
        key: "key",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      authorizeBGGAccess("expired", {
        url: "https://example.supabase.co",
        key: "key",
        fetch: async () =>
          response(
            JSON.stringify({ message: "Expired", error_code: "bad_jwt" }),
            401,
          ),
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("checks authorization before serving even a cached lookup and returns safe errors", async () => {
    let upstream = false;
    const result = await handleBGGRequest(
      { kind: "game", id: 174430, accessToken: "forged" },
      {
        authorize: async () => {
          throw Object.assign(new Error("private details"), {
            code: "FORBIDDEN",
          });
        },
        client: {
          game: async () => {
            upstream = true;
          },
          search: async () => [],
        } as never,
      },
    );
    expect(result).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(upstream).toBe(false);
  });
  it.each([
    { kind: "game", id: -1 },
    { kind: "game", id: "174430" },
    { kind: "search", query: "" },
    { kind: "game", id: 1, refresh: "yes" },
  ])(
    "rejects invalid requests before invoking dependencies",
    async (invalid) => {
      const authorize = vi.fn();
      expect(
        await handleBGGRequest(
          { ...invalid, accessToken: "token" },
          { authorize, client: {} as never },
        ),
      ).toEqual({ ok: false, error: "INVALID_INPUT" });
      expect(authorize).not.toHaveBeenCalled();
    },
  );
});
