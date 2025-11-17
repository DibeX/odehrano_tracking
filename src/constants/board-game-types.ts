// Board game type classification (broader categories than BGG categories)
export const BOARD_GAME_TYPES = [
  'abstract_strategy',
  'customizable',
  'thematic',
  'family',
  'children',
  'party',
  'strategy',
  'wargames',
] as const;

export type BoardGameType = (typeof BOARD_GAME_TYPES)[number];

// Helper to get translated labels for board game types
// Usage: getBoardGameTypeLabel('abstract_strategy', _) where _ is from useLingui
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';

export const BOARD_GAME_TYPE_LABELS: Record<BoardGameType, MessageDescriptor> = {
  abstract_strategy: msg`Abstract Strategy Games`,
  customizable: msg`Customizable Games`,
  thematic: msg`Thematic Games`,
  family: msg`Family Games`,
  children: msg`Children's Games`,
  party: msg`Party Games`,
  strategy: msg`Strategy Games`,
  wargames: msg`Wargames`,
};

type TranslateFunction = (descriptor: MessageDescriptor) => string;

export function getBoardGameTypeLabel(type: BoardGameType, _: TranslateFunction): string {
  return _(BOARD_GAME_TYPE_LABELS[type]);
}
