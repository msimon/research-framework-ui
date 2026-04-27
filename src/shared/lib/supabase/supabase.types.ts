export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      deep_research_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          last_turn_at: string | null
          seed_question: string
          status: string
          summary_md: string
          topic_id: string
          turn_count: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          last_turn_at?: string | null
          seed_question: string
          status?: string
          summary_md?: string
          topic_id: string
          turn_count?: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          last_turn_at?: string | null
          seed_question?: string
          status?: string
          summary_md?: string
          topic_id?: string
          turn_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deep_research_sessions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      deep_research_turns: {
        Row: {
          created_at: string
          error_message: string | null
          findings_md: string | null
          followup_question: string | null
          id: string
          insights: Json
          model_used: string | null
          my_read_md: string | null
          reasoning_md: string | null
          role: string
          session_id: string
          status: string
          tool_calls: Json
          turn_number: number
          updated_at: string
          user_text: string | null
          workflow_instance_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          findings_md?: string | null
          followup_question?: string | null
          id?: string
          insights?: Json
          model_used?: string | null
          my_read_md?: string | null
          reasoning_md?: string | null
          role: string
          session_id: string
          status?: string
          tool_calls?: Json
          turn_number: number
          updated_at?: string
          user_text?: string | null
          workflow_instance_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          findings_md?: string | null
          followup_question?: string | null
          id?: string
          insights?: Json
          model_used?: string | null
          my_read_md?: string | null
          reasoning_md?: string | null
          role?: string
          session_id?: string
          status?: string
          tool_calls?: Json
          turn_number?: number
          updated_at?: string
          user_text?: string | null
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deep_research_turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "deep_research_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      init_interview_turns: {
        Row: {
          agent_step: Json
          created_at: string
          id: string
          subject_id: string
          turn_number: number
          updated_at: string
          user_answer: Json | null
        }
        Insert: {
          agent_step: Json
          created_at?: string
          id?: string
          subject_id: string
          turn_number: number
          updated_at?: string
          user_answer?: Json | null
        }
        Update: {
          agent_step?: Json
          created_at?: string
          id?: string
          subject_id?: string
          turn_number?: number
          updated_at?: string
          user_answer?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "init_interview_turns_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      landscapes: {
        Row: {
          content_md: string
          created_at: string
          error_message: string | null
          id: string
          status: string
          topic_id: string
          updated_at: string
          workflow_instance_id: string | null
        }
        Insert: {
          content_md?: string
          created_at?: string
          error_message?: string | null
          id?: string
          status?: string
          topic_id: string
          updated_at?: string
          workflow_instance_id?: string | null
        }
        Update: {
          content_md?: string
          created_at?: string
          error_message?: string | null
          id?: string
          status?: string
          topic_id?: string
          updated_at?: string
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landscapes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: true
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          created_at: string
          id: string
          landscape_id: string | null
          retrieved_at: string
          session_id: string | null
          snippet: string | null
          title: string | null
          topic_id: string
          turn_id: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          landscape_id?: string | null
          retrieved_at?: string
          session_id?: string | null
          snippet?: string | null
          title?: string | null
          topic_id: string
          turn_id?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          landscape_id?: string | null
          retrieved_at?: string
          session_id?: string | null
          snippet?: string | null
          title?: string | null
          topic_id?: string
          turn_id?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_landscape_id_fkey"
            columns: ["landscape_id"]
            isOneToOne: false
            referencedRelation: "landscapes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "deep_research_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "deep_research_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          framing: Json
          id: string
          lexicon_md: string
          open_questions_md: string
          research_brief_md: string
          seed_problem_statement: string | null
          slug: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          framing?: Json
          id?: string
          lexicon_md?: string
          open_questions_md?: string
          research_brief_md?: string
          seed_problem_statement?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          framing?: Json
          id?: string
          lexicon_md?: string
          open_questions_md?: string
          research_brief_md?: string
          seed_problem_statement?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          category: string
          created_at: string
          discover_hint: string | null
          id: string
          parent_topic_id: string | null
          pitch: string
          rationale: string
          slug: string
          sort_order: number
          status: string
          subject_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          discover_hint?: string | null
          id?: string
          parent_topic_id?: string | null
          pitch: string
          rationale?: string
          slug: string
          sort_order?: number
          status?: string
          subject_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          discover_hint?: string | null
          id?: string
          parent_topic_id?: string | null
          pitch?: string
          rationale?: string
          slug?: string
          sort_order?: number
          status?: string
          subject_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_parent_topic_id_fkey"
            columns: ["parent_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          id: string
          name: string | null
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: { Args: { required_role: string }; Returns: boolean }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

