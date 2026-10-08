import type { BGGGameInfo } from "@/types";

export const BGG_ERROR_CODES = [
  "INVALID_INPUT",
  "NOT_CONFIGURED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "BGG_AUTH",
  "NOT_FOUND",
  "INVALID_RESPONSE",
  "UNAVAILABLE",
  "TIMEOUT",
] as const;
export type BGGErrorCode = (typeof BGG_ERROR_CODES)[number];
export class BGGError extends Error {
  constructor(public readonly code: BGGErrorCode) {
    super(code);
    this.name = "BGGError";
  }
}
export interface BGGSearchResult {
  id: number;
  name: string;
  yearPublished: number | null;
}
export type BGGRequest = { accessToken: string } & (
  | { kind: "game"; id: number; refresh?: boolean }
  | { kind: "search"; query: string }
);
export type BGGResult =
  | { ok: true; data: BGGGameInfo | BGGSearchResult[] }
  | { ok: false; error: BGGErrorCode };
