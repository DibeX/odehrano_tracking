export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'admin' | 'moderator' | 'player';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          nickname: string;
          avatar_url: string | null;
          description: string | null;
          role: UserRole;
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          nickname: string;
          avatar_url?: string | null;
          description?: string | null;
          role?: UserRole;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          nickname?: string;
          avatar_url?: string | null;
          description?: string | null;
          role?: UserRole;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_invitations: {
        Row: {
          id: string;
          email: string;
          token: string;
          role: UserRole;
          created_by: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          token: string;
          role?: UserRole;
          created_by: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          token?: string;
          role?: UserRole;
          created_by?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      board_games: {
        Row: {
          id: string;
          bgg_id: number | null;
          name: string;
          original_name: string | null;
          alternate_names: string[];
          image_url: string | null;
          year_published: number | null;
          categories: string[];
          publishers: string[];
          bgg_rank: number | null;
          bgg_rating: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bgg_id?: number | null;
          name: string;
          original_name?: string | null;
          alternate_names?: string[];
          image_url?: string | null;
          year_published?: number | null;
          categories?: string[];
          publishers?: string[];
          bgg_rank?: number | null;
          bgg_rating?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          bgg_id?: number | null;
          name?: string;
          original_name?: string | null;
          alternate_names?: string[];
          image_url?: string | null;
          year_published?: number | null;
          categories?: string[];
          publishers?: string[];
          bgg_rank?: number | null;
          bgg_rating?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      played_games: {
        Row: {
          id: string;
          board_game_id: string;
          custom_name: string | null;
          played_at: string;
          note: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          board_game_id: string;
          custom_name?: string | null;
          played_at: string;
          note?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          board_game_id?: string;
          custom_name?: string | null;
          played_at?: string;
          note?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      played_game_players: {
        Row: {
          id: string;
          played_game_id: string;
          user_id: string;
          score: number | null;
          is_winner: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          played_game_id: string;
          user_id: string;
          score?: number | null;
          is_winner?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          played_game_id?: string;
          user_id?: string;
          score?: number | null;
          is_winner?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      played_game_comments: {
        Row: {
          id: string;
          played_game_id: string;
          user_id: string;
          comment: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          played_game_id: string;
          user_id: string;
          comment: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          played_game_id?: string;
          user_id?: string;
          comment?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ranking_years: {
        Row: {
          id: string;
          year: number;
          is_locked: boolean;
          is_public: boolean;
          deadline: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          year: number;
          is_locked?: boolean;
          is_public?: boolean;
          deadline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          year?: number;
          is_locked?: boolean;
          is_public?: boolean;
          deadline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_game_rankings: {
        Row: {
          id: string;
          user_id: string;
          board_game_id: string;
          year: number;
          rank: number;
          is_manually_added: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          board_game_id: string;
          year: number;
          rank: number;
          is_manually_added?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          board_game_id?: string;
          year?: number;
          rank?: number;
          is_manually_added?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      category_presets: {
        Row: {
          id: string;
          name: string;
          categories: string[];
          created_by: string;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          categories: string[];
          created_by: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          categories?: string[];
          created_by?: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
