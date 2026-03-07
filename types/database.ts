/**
 * TypeScript типы для базы данных Supabase
 * 
 * Эти типы генерируются автоматически из схемы БД.
 * Для продакшн используйте Supabase CLI: supabase gen types typescript
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type EventType = "qualifier" | "regional" | "championship" | "scrimmage" | "premier";
export type UserRole = "team_member" | "coach" | "admin";
export type AgreementStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string;
          number: number;
          name: string;
          region: string | null;
          rookie_year: number | null;
          robot_photo_url: string | null;
          robot_features: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          number: number;
          name: string;
          region?: string | null;
          rookie_year?: number | null;
          robot_photo_url?: string | null;
          robot_features?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          number?: number;
          name?: string;
          region?: string | null;
          rookie_year?: number | null;
          robot_photo_url?: string | null;
          robot_features?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          season: number;
          code: string;
          name: string;
          start_date: string | null;
          end_date: string | null;
          location: string | null;
          type: EventType | null;
          has_matches: boolean;
          ftcscout_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          season: number;
          code: string;
          name: string;
          start_date?: string | null;
          end_date?: string | null;
          location?: string | null;
          type?: EventType | null;
          has_matches?: boolean;
          ftcscout_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          season?: number;
          code?: string;
          name?: string;
          start_date?: string | null;
          end_date?: string | null;
          location?: string | null;
          type?: EventType | null;
          has_matches?: boolean;
          ftcscout_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      team_event_participations: {
        Row: {
          id: string;
          team_id: string;
          event_id: string;
          is_confirmed: boolean;
          stats: Json;
          awards: Json;
          rank: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          event_id: string;
          is_confirmed?: boolean;
          stats?: Json;
          awards?: Json;
          rank?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          event_id?: string;
          is_confirmed?: boolean;
          stats?: Json;
          awards?: Json;
          rank?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      pre_match_agreements: {
        Row: {
          id: string;
          event_id: string;
          sender_team_id: string;
          receiver_team_id: string;
          message: string;
          video_url: string | null;
          status: AgreementStatus;
          compatibility_score: number | null;
          created_at: string;
          updated_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          sender_team_id: string;
          receiver_team_id: string;
          message: string;
          video_url?: string | null;
          status?: AgreementStatus;
          compatibility_score?: number | null;
          created_at?: string;
          updated_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          sender_team_id?: string;
          receiver_team_id?: string;
          message?: string;
          video_url?: string | null;
          status?: AgreementStatus;
          compatibility_score?: number | null;
          created_at?: string;
          updated_at?: string;
          responded_at?: string | null;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          role: UserRole;
          team_id: string | null;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: UserRole;
          team_id?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: UserRole;
          team_id?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}




