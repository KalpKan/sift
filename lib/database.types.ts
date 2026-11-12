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
  sift: {
    Tables: {
      follows: {
        Row: {
          created_at: string
          topic_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          topic_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      interests: {
        Row: {
          source: string
          term: string
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          source: string
          term: string
          updated_at?: string
          user_id: string
          weight: number
        }
        Update: {
          source?: string
          term?: string
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      opens: {
        Row: {
          created_at: string
          id: string
          pmid: string
          surface: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pmid: string
          surface: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pmid?: string
          surface?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opens_pmid_fkey"
            columns: ["pmid"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["pmid"]
          },
        ]
      }
      papers: {
        Row: {
          authors: string[] | null
          doi: string | null
          first_seen_at: string
          journal: string | null
          pmid: string
          pub_types: string[] | null
          published_on: string | null
          raw: Json | null
          title: string
          url: string | null
        }
        Insert: {
          authors?: string[] | null
          doi?: string | null
          first_seen_at?: string
          journal?: string | null
          pmid: string
          pub_types?: string[] | null
          published_on?: string | null
          raw?: Json | null
          title: string
          url?: string | null
        }
        Update: {
          authors?: string[] | null
          doi?: string | null
          first_seen_at?: string
          journal?: string | null
          pmid?: string
          pub_types?: string[] | null
          published_on?: string | null
          raw?: Json | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          matched_terms: string[] | null
          pmid: string
          ranker_version: string
          recency_rank: number
          shown_rank: number
          surface: string
          topic_id: string | null
          updated_at: string
          user_id: string
          verdict: number
        }
        Insert: {
          created_at?: string
          matched_terms?: string[] | null
          pmid: string
          ranker_version: string
          recency_rank: number
          shown_rank: number
          surface: string
          topic_id?: string | null
          updated_at?: string
          user_id: string
          verdict: number
        }
        Update: {
          created_at?: string
          matched_terms?: string[] | null
          pmid?: string
          ranker_version?: string
          recency_rank?: number
          shown_rank?: number
          surface?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
          verdict?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_pmid_fkey"
            columns: ["pmid"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["pmid"]
          },
          {
            foreignKeyName: "ratings_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      refresh_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          papers_added: number | null
          papers_seen: number | null
          started_at: string
          topic_id: string | null
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          papers_added?: number | null
          papers_seen?: number | null
          started_at?: string
          topic_id?: string | null
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          papers_added?: number | null
          papers_seen?: number | null
          started_at?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refresh_runs_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_papers: {
        Row: {
          pmid: string
          ranked_at: string
          score: number
          score_reasons: Json | null
          topic_id: string
        }
        Insert: {
          pmid: string
          ranked_at?: string
          score: number
          score_reasons?: Json | null
          topic_id: string
        }
        Update: {
          pmid?: string
          ranked_at?: string
          score?: number
          score_reasons?: Json | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_papers_pmid_fkey"
            columns: ["pmid"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["pmid"]
          },
          {
            foreignKeyName: "topic_papers_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          pubmed_query: string
          slug: string
          source: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          pubmed_query: string
          slug: string
          source?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          pubmed_query?: string
          slug?: string
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
  sift: {
    Enums: {},
  },
} as const

