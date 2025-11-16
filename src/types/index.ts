import type { Database } from './database';

export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type UserInvitation = Database['public']['Tables']['user_invitations']['Row'];
export type UserInvitationInsert = Database['public']['Tables']['user_invitations']['Insert'];

export type BoardGame = Database['public']['Tables']['board_games']['Row'];
export type BoardGameInsert = Database['public']['Tables']['board_games']['Insert'];
export type BoardGameUpdate = Database['public']['Tables']['board_games']['Update'];

export type PlayedGame = Database['public']['Tables']['played_games']['Row'];
export type PlayedGameInsert = Database['public']['Tables']['played_games']['Insert'];
export type PlayedGameUpdate = Database['public']['Tables']['played_games']['Update'];

export type PlayedGamePlayer = Database['public']['Tables']['played_game_players']['Row'];
export type PlayedGamePlayerInsert = Database['public']['Tables']['played_game_players']['Insert'];

export type PlayedGameComment = Database['public']['Tables']['played_game_comments']['Row'];
export type PlayedGameCommentInsert = Database['public']['Tables']['played_game_comments']['Insert'];

export type RankingYear = Database['public']['Tables']['ranking_years']['Row'];
export type RankingYearInsert = Database['public']['Tables']['ranking_years']['Insert'];
export type RankingYearUpdate = Database['public']['Tables']['ranking_years']['Update'];

export type UserGameRanking = Database['public']['Tables']['user_game_rankings']['Row'];
export type UserGameRankingInsert = Database['public']['Tables']['user_game_rankings']['Insert'];
export type UserGameRankingUpdate = Database['public']['Tables']['user_game_rankings']['Update'];

export type CategoryPreset = Database['public']['Tables']['category_presets']['Row'];
export type CategoryPresetInsert = Database['public']['Tables']['category_presets']['Insert'];
export type CategoryPresetUpdate = Database['public']['Tables']['category_presets']['Update'];

export type UserRole = Database['public']['Enums']['user_role'];

export type RankingScheme = 'equal' | 'damped' | 'linear';

export interface BGGGameInfo {
  id: number;
  name: string;
  alternateNames: string[];
  yearPublished: number | null;
  imageUrl: string | null;
  categories: string[];
  publishers: string[];
  rank: number | null;
  rating: number | null;
}

export interface PlayedGameWithDetails extends PlayedGame {
  board_game: BoardGame;
  players: (PlayedGamePlayer & { user: User })[];
  comments: (PlayedGameComment & { user: User })[];
  creator: User;
}

export interface RankingResult {
  game: BoardGame;
  score: number;
  normalizedScore: number;
  playerContributions: {
    user: User;
    rank: number;
    contribution: number;
  }[];
  tieBreakInfo?: {
    firstPlaceVotes: number;
    topTwoVotes: number;
  };
}
