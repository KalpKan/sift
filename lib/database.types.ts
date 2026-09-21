export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  adspace: {
    Tables: {
      advertisers: {
        Row: {
          contact_email: string
          created_at: string
          dashboard_key: string
          id: string
          name: string
          status: string
        }
        Insert: {
          contact_email: string
          created_at?: string
          dashboard_key: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          contact_email?: string
          created_at?: string
          dashboard_key?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      creatives: {
        Row: {
          accent_hex: string
          advertiser_id: string
          body: string | null
          created_at: string
          cta_label: string
          cta_url: string | null
          daily_cap: number | null
          headline: string
          id: string
          payout_cents: number
          price_cents: number
          status: string
          updated_at: string
        }
        Insert: {
          accent_hex?: string
          advertiser_id: string
          body?: string | null
          created_at?: string
          cta_label?: string
          cta_url?: string | null
          daily_cap?: number | null
          headline: string
          id?: string
          payout_cents?: number
          price_cents?: number
          status?: string
          updated_at?: string
        }
        Update: {
          accent_hex?: string
          advertiser_id?: string
          body?: string | null
          created_at?: string
          cta_label?: string
          cta_url?: string | null
          daily_cap?: number | null
          headline?: string
          id?: string
          payout_cents?: number
          price_cents?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creatives_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          id: string
          install_id: string
          last_seen_at: string
          platform: string
        }
        Insert: {
          created_at?: string
          id?: string
          install_id: string
          last_seen_at?: string
          platform: string
        }
        Update: {
          created_at?: string
          id?: string
          install_id?: string
          last_seen_at?: string
          platform?: string
        }
        Relationships: []
      }
      impressions: {
        Row: {
          confirmed_at: string | null
          creative_id: string
          device_id: string
          expires_at: string
          id: string
          issued_at: string
          nonce: string
        }
        Insert: {
          confirmed_at?: string | null
          creative_id: string
          device_id: string
          expires_at: string
          id?: string
          issued_at?: string
          nonce: string
        }
        Update: {
          confirmed_at?: string | null
          creative_id?: string
          device_id?: string
          expires_at?: string
          id?: string
          issued_at?: string
          nonce?: string
        }
        Relationships: [
          {
            foreignKeyName: "impressions_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creative_stats"
            referencedColumns: ["creative_id"]
          },
          {
            foreignKeyName: "impressions_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impressions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device_balances"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "impressions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount_cents: number
          created_at: string
          device_id: string
          id: string
          impression_id: string | null
          kind: string
          note: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          device_id: string
          id?: string
          impression_id?: string | null
          kind: string
          note?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          device_id?: string
          id?: string
          impression_id?: string | null
          kind?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device_balances"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "ledger_entries_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_impression_id_fkey"
            columns: ["impression_id"]
            isOneToOne: true
            referencedRelation: "impressions"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_cents: number
          device_id: string
          id: string
          method: string
          note: string | null
          paid_at: string | null
          requested_at: string
          status: string
        }
        Insert: {
          amount_cents: number
          device_id: string
          id?: string
          method: string
          note?: string | null
          paid_at?: string | null
          requested_at?: string
          status?: string
        }
        Update: {
          amount_cents?: number
          device_id?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string | null
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device_balances"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "payouts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      creative_stats: {
        Row: {
          advertiser_id: string | null
          confirmed: number | null
          creative_id: string | null
          headline: string | null
          issued: number | null
          last_confirmed_at: string | null
          payout_cents: number | null
          price_cents: number | null
          spend_cents: number | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creatives_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      device_balances: {
        Row: {
          balance_cents: number | null
          confirmed_views: number | null
          device_id: string | null
          install_id: string | null
          last_seen_at: string | null
          lifetime_earned_cents: number | null
          platform: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      health_select_one: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  adspace: {
    Enums: {},
  },
} as const
