import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { BGGError, type BGGErrorCode } from "./bgg-contract";
import type { BGGMetadataField } from "./bgg-metadata";

const errors: Record<BGGErrorCode, MessageDescriptor> = {
  INVALID_INPUT: msg`Enter a valid game name, positive BGG ID, or BoardGameGeek game URL.`,
  NOT_CONFIGURED: msg`BGG access is not configured. Ask an administrator to set the server's BGG_API_TOKEN.`,
  UNAUTHORIZED: msg`Your session has expired. Sign in again to use BGG.`,
  FORBIDDEN: msg`Only moderators and administrators can import BGG metadata.`,
  BGG_AUTH: msg`BGG rejected the application token. Ask an administrator to check BGG_API_TOKEN.`,
  NOT_FOUND: msg`This board game was not found on BGG. Check the ID or try searching by name.`,
  INVALID_RESPONSE: msg`BGG returned an unreadable response. Please try again later.`,
  UNAVAILABLE: msg`BGG is temporarily unavailable or busy. Please try again shortly.`,
  TIMEOUT: msg`BGG took too long to respond. Please try again.`,
};
export function getBGGErrorMessage(
  error: unknown,
  translate: (message: MessageDescriptor) => string,
): string {
  return translate(
    errors[error instanceof BGGError ? error.code : "UNAVAILABLE"],
  );
}
export const BGG_FIELD_LABELS: Record<BGGMetadataField, MessageDescriptor> = {
  name: msg`Primary Name`,
  alternate_names: msg`Alternate Names`,
  image_url: msg`Game Image`,
  year_published: msg`Year Released`,
  publishers: msg`Publishers`,
  categories: msg`Categories`,
  bgg_rank: msg`BGG Rank`,
  bgg_rating: msg`BGG Rating`,
};
