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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          id: string
          last_login: string | null
          password_hash: string
          role: Database["public"]["Enums"]["admin_role"]
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_login?: string | null
          password_hash: string
          role?: Database["public"]["Enums"]["admin_role"]
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          last_login?: string | null
          password_hash?: string
          role?: Database["public"]["Enums"]["admin_role"]
          username?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          assigned_at: string
          beneficiary_its_id: string
          completed_at: string | null
          id: string
          status: Database["public"]["Enums"]["assignment_status"]
          student_tr_number: string
        }
        Insert: {
          assigned_at?: string
          beneficiary_its_id: string
          completed_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          student_tr_number: string
        }
        Update: {
          assigned_at?: string
          beneficiary_its_id?: string
          completed_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          student_tr_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_beneficiary_its_id_fkey"
            columns: ["beneficiary_its_id"]
            isOneToOne: true
            referencedRelation: "beneficiaries"
            referencedColumns: ["its_id"]
          },
          {
            foreignKeyName: "assignments_student_tr_number_fkey"
            columns: ["student_tr_number"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["tr_number"]
          },
        ]
      }
      beneficiaries: {
        Row: {
          age: number | null
          created_at: string
          email: string | null
          full_name: string
          gender: string | null
          its_id: string
          jamaat: string | null
          mobile: string | null
        }
        Insert: {
          age?: number | null
          created_at?: string
          email?: string | null
          full_name: string
          gender?: string | null
          its_id: string
          jamaat?: string | null
          mobile?: string | null
        }
        Update: {
          age?: number | null
          created_at?: string
          email?: string | null
          full_name?: string
          gender?: string | null
          its_id?: string
          jamaat?: string | null
          mobile?: string | null
        }
        Relationships: []
      }
      student_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          student_tr_number: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          student_tr_number: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          student_tr_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_sessions_student_tr_number_fkey"
            columns: ["student_tr_number"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["tr_number"]
          },
        ]
      }
      students: {
        Row: {
          branch: string | null
          created_at: string
          email: string | null
          is_active: boolean
          its_id: string
          name: string
          tr_number: string
        }
        Insert: {
          branch?: string | null
          created_at?: string
          email?: string | null
          is_active?: boolean
          its_id: string
          name: string
          tr_number: string
        }
        Update: {
          branch?: string | null
          created_at?: string
          email?: string | null
          is_active?: boolean
          its_id?: string
          name?: string
          tr_number?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      admin_role: "admin" | "super_admin"
      assignment_status: "pending" | "completed"
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
  public: {
    Enums: {
      admin_role: ["admin", "super_admin"],
      assignment_status: ["pending", "completed"],
    },
  },
} as const
