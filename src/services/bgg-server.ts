import { XMLParser, XMLValidator } from "fast-xml-parser";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { BGGGameInfo } from "@/types";
import {
  BGGError,
  BGG_ERROR_CODES,
  type BGGErrorCode,
  type BGGResult,
  type BGGSearchResult,
} from "./bgg-contract";

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) => ["item", "name", "link", "rank"].includes(name),
});
type XMLNode = Record<string, any>;
function itemsFromXML(xml: string): XMLNode[] {
  if (
    xml.length > 2_000_000 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw new BGGError("INVALID_RESPONSE");
  const document = parser.parse(xml);
  if (!Object.hasOwn(document, "items")) throw new BGGError("INVALID_RESPONSE");
  return document.items?.item ?? [];
}
function numberOrNull(value: unknown, integer = false): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) &&
    number > 0 &&
    (!integer || Number.isSafeInteger(number))
    ? number
    : null;
}
function publicationYear(value: unknown): number | null {
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) return null;
  const year = Number(value);
  return Number.isSafeInteger(year) && year !== 0 ? year : null;
}
function strings(values: XMLNode[], type: string): string[] {
  return [
    ...new Set(
      values
        .filter((value) => value["@_type"] === type)
        .map((value) => value["@_value"])
        .filter(
          (value): value is string =>
            typeof value === "string" && !!value.trim(),
        ),
    ),
  ];
}
function boardGameItem(item: XMLNode): boolean {
  return ["boardgame", "boardgameexpansion"].includes(item["@_type"]);
}
function imageURL(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function parseBGGGame(xml: string, id: number): BGGGameInfo {
  const item = itemsFromXML(xml).find(
    (item) => Number(item["@_id"]) === id && boardGameItem(item),
  );
  if (!item) throw new BGGError("NOT_FOUND");
  const names: XMLNode[] = item.name ?? [];
  const name = names.find((name) => name["@_type"] === "primary")?.["@_value"];
  if (typeof name !== "string" || !name.trim())
    throw new BGGError("INVALID_RESPONSE");
  const ratings = item.statistics?.ratings;
  const rating = numberOrNull(ratings?.average?.["@_value"]);
  return {
    id,
    name,
    alternateNames: strings(names, "alternate"),
    yearPublished: publicationYear(item.yearpublished?.["@_value"]),
    imageUrl: imageURL(item.image),
    categories: strings(item.link ?? [], "boardgamecategory"),
    publishers: strings(item.link ?? [], "boardgamepublisher"),
    rank: numberOrNull(
      ratings?.ranks?.rank?.find(
        (rank: XMLNode) => rank["@_name"] === "boardgame",
      )?.["@_value"],
      true,
    ),
    rating: rating !== null && rating <= 10 ? rating : null,
  };
}
export function parseBGGSearch(xml: string): BGGSearchResult[] {
  const seen = new Set<number>();
  return itemsFromXML(xml).flatMap((item) => {
    const id = numberOrNull(item["@_id"], true);
    const name = item.name?.[0]?.["@_value"];
    if (
      !boardGameItem(item) ||
      id === null ||
      typeof name !== "string" ||
      !name.trim() ||
      seen.has(id)
    )
      return [];
    seen.add(id);
    return [
      {
        id,
        name,
        yearPublished: publicationYear(item.yearpublished?.["@_value"]),
      },
    ];
  });
}

interface BGGClientOptions {
  token: () => string | undefined;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}
export function createBGGClient(options: BGGClientOptions) {
  const fetcher = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const cache = new Map<
    string,
    { value: BGGGameInfo | BGGSearchResult[]; expires: number }
  >();
  const pending = new Map<string, Promise<BGGGameInfo | BGGSearchResult[]>>();
  let queue: Promise<unknown> = Promise.resolve();
  let nextRequest = 0;

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const operation = queue.then(async () => {
      const delay = nextRequest - now();
      if (delay > 0) await sleep(delay);
      nextRequest = now() + 5000;
      return task();
    });
    queue = operation.catch(() => {});
    return operation;
  }
  async function upstream(url: string): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      let result: Response;
      try {
        result = await enqueue(() => {
          const token = options.token()?.trim();
          if (!token) throw new BGGError("NOT_CONFIGURED");
          return fetcher(url, {
            headers: {
              Accept: "application/xml",
              Authorization: `Bearer ${token}`,
            },
            signal: AbortSignal.timeout(8000),
            redirect: "error",
          });
        });
      } catch (error) {
        if (error instanceof BGGError) throw error;
        if (attempt === 2)
          throw new BGGError(
            error instanceof Error &&
            ["TimeoutError", "AbortError"].includes(error.name)
              ? "TIMEOUT"
              : "UNAVAILABLE",
          );
        continue;
      }
      if (result.status === 401 || result.status === 403)
        throw new BGGError("BGG_AUTH");
      if (result.status === 404) throw new BGGError("NOT_FOUND");
      if ([202, 429, 500, 502, 503, 504].includes(result.status)) {
        if (attempt === 2) throw new BGGError("UNAVAILABLE");
        const retryAfter = result.headers.get("Retry-After");
        const requestedDelay = retryAfter
          ? /^\d+$/.test(retryAfter)
            ? Number(retryAfter) * 1000
            : Date.parse(retryAfter) - now()
          : 5000;
        await sleep(
          Math.min(
            10_000,
            Math.max(
              5000,
              Number.isFinite(requestedDelay) ? requestedDelay : 5000,
            ),
          ),
        );
        continue;
      }
      if (!result.ok) throw new BGGError("UNAVAILABLE");
      try {
        return await result.text();
      } catch {
        throw new BGGError("UNAVAILABLE");
      }
    }
    throw new BGGError("UNAVAILABLE");
  }
  async function lookup<T extends BGGGameInfo | BGGSearchResult[]>(
    url: string,
    parse: (xml: string) => T,
    ttl: number,
    refresh = false,
  ): Promise<T> {
    if (!options.token()?.trim()) throw new BGGError("NOT_CONFIGURED");
    const cached = cache.get(url);
    if (!refresh && cached && cached.expires > now())
      return structuredClone(cached.value) as T;
    const key = `${url}:${refresh}`;
    if (pending.has(key)) return structuredClone(await pending.get(key)) as T;
    if (pending.size >= 20) throw new BGGError("UNAVAILABLE");
    const request = upstream(url).then((xml) => {
      const value = parse(xml);
      cache.delete(url);
      cache.set(url, { value, expires: now() + ttl });
      if (cache.size > 200) cache.delete(cache.keys().next().value!);
      return value;
    });
    pending.set(key, request);
    try {
      return structuredClone(await request);
    } finally {
      pending.delete(key);
    }
  }
  return {
    game: (id: number, refresh = false) =>
      lookup(
        `https://boardgamegeek.com/xmlapi2/thing?id=${id}&stats=1`,
        (xml) => parseBGGGame(xml, id),
        24 * 60 * 60 * 1000,
        refresh,
      ),
    search: (query: string) => {
      const params = new URLSearchParams({
        query,
        type: "boardgame,boardgameexpansion",
      });
      return lookup(
        `https://boardgamegeek.com/xmlapi2/search?${params.toString().replace("%2C", ",")}`,
        parseBGGSearch,
        10 * 60 * 1000,
      );
    },
  };
}

interface SupabaseAccessConfig {
  url: string;
  key: string;
  fetch?: typeof fetch;
}
export async function authorizeBGGAccess(
  accessToken: string,
  config: SupabaseAccessConfig,
): Promise<void> {
  if (!accessToken) throw new BGGError("UNAUTHORIZED");
  const fetcher = config.fetch ?? fetch;
  const supabase = createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
      fetch: (input, init) =>
        fetcher(input, { ...init, signal: AbortSignal.timeout(8000) }),
    },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new BGGError("UNAUTHORIZED");
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  if (
    profileError ||
    !profile ||
    !["admin", "moderator"].includes(profile.role)
  )
    throw new BGGError("FORBIDDEN");
}

const requestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("game"),
    id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    refresh: z.boolean().optional(),
    accessToken: z.string().min(1).max(8192),
  }),
  z.object({
    kind: z.literal("search"),
    query: z.string().trim().min(2).max(200),
    accessToken: z.string().min(1).max(8192),
  }),
]);
export async function handleBGGRequest(
  input: unknown,
  dependencies: {
    authorize: (token: string) => Promise<void>;
    client: ReturnType<typeof createBGGClient>;
  },
): Promise<BGGResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  try {
    await dependencies.authorize(parsed.data.accessToken);
    const data =
      parsed.data.kind === "game"
        ? await dependencies.client.game(parsed.data.id, parsed.data.refresh)
        : await dependencies.client.search(parsed.data.query);
    return { ok: true, data };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? error.code
        : undefined;
    return {
      ok: false,
      error: BGG_ERROR_CODES.includes(code as BGGErrorCode)
        ? (code as BGGErrorCode)
        : "UNAVAILABLE",
    };
  }
}

const client = createBGGClient({ token: () => process.env.BGG_API_TOKEN });
export function runBGGRequest(input: unknown): Promise<BGGResult> {
  return handleBGGRequest(input, {
    client,
    authorize: (token) =>
      authorizeBGGAccess(token, {
        url: import.meta.env.VITE_SUPABASE_URL,
        key: import.meta.env.VITE_SUPABASE_ANON_KEY,
      }),
  });
}
