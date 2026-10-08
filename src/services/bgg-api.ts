import { supabase } from "@/lib/supabase";
import type { BGGGameInfo } from "@/types";
import {
  BGGError,
  type BGGRequest,
  type BGGSearchResult,
} from "./bgg-contract";
import { bggRequest } from "./bgg-functions";

async function request(
  input:
    | Omit<Extract<BGGRequest, { kind: "game" }>, "accessToken">
    | Omit<Extract<BGGRequest, { kind: "search" }>, "accessToken">,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new BGGError("UNAUTHORIZED");
  try {
    const result = await bggRequest({
      data: { ...input, accessToken: session.access_token },
    });
    if (!result.ok) throw new BGGError(result.error);
    return result.data;
  } catch (error) {
    if (error instanceof BGGError) throw error;
    throw new BGGError("UNAVAILABLE");
  }
}

export async function fetchBGGGame(
  id: number,
  options: { refresh?: boolean } = {},
): Promise<BGGGameInfo> {
  const data = await request({ kind: "game", id, refresh: options.refresh });
  if (Array.isArray(data)) throw new BGGError("INVALID_RESPONSE");
  return data;
}
export async function searchBGGGames(
  query: string,
): Promise<BGGSearchResult[]> {
  const data = await request({ kind: "search", query });
  if (!Array.isArray(data)) throw new BGGError("INVALID_RESPONSE");
  return data;
}
