export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          role: "admin" | "user";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          role?: "admin" | "user";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          display_name?: string | null;
          role?: "admin" | "user";
          updated_at?: string;
        };
      };
      catalog_items: {
        Row: {
          id: string;
          sku: string;
          name: string;
          category: string;
          unit_price: number;
          msrp: number | null;
          vendor: string | null;
          inventory: number | null;
          notes: string | null;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      quote_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_by: string | null;
          updated_by: string | null;
          collaborators: string[] | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      template_lines: {
        Row: {
          id: string;
          template_id: string;
          item_id: string;
          quantity: number;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      quotes: {
        Row: {
          id: string;
          share_token: string;
          quote_number: string;
          customer: string;
          project: string;
          location: string | null;
          email: string | null;
          margin_percent: number;
          tax_percent: number;
          include_labor: boolean;
          labor_hours: number | null;
          labor_rate: number | null;
          scope_of_work: string | null;
          notes: string | null;
          lines_snapshot: Json;
          total: number;
          revision: number;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      quote_revisions: {
        Row: {
          id: string;
          quote_id: string;
          revision: number;
          summary: string | null;
          changed_by: string | null;
          meta_snapshot: Json;
          lines_snapshot: Json;
          total: number;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      draft_quotes: {
        Row: {
          id: string;
          owner_id: string;
          device_id: string | null;
          kind: "current" | "saved";
          quote_step: "pick" | "customize" | "review" | "finalize";
          meta_snapshot: Json;
          lines_snapshot: Json;
          total: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      user_sessions: {
        Row: {
          id: string;
          user_id: string;
          device_id: string;
          device_name: string;
          revoked_at: string | null;
          ended_at: string | null;
          created_at: string;
          last_seen_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      debug_logs: {
        Row: {
          id: string;
          type: "auth" | "session" | "sync" | "database" | "ui";
          level: "info" | "warning" | "error";
          message: string;
          user_id: string | null;
          device_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      app_settings: {
        Row: {
          key: string;
          value: Json;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          value?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
