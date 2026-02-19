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
      alert_rules: {
        Row: {
          correlation_metric: string | null
          correlation_operator: string | null
          correlation_threshold: number | null
          created_at: string
          duration_seconds: number
          enabled: boolean
          id: string
          metric_type: string
          name: string
          operator: string
          severity: string
          threshold: number
          updated_at: string
          user_id: string
        }
        Insert: {
          correlation_metric?: string | null
          correlation_operator?: string | null
          correlation_threshold?: number | null
          created_at?: string
          duration_seconds?: number
          enabled?: boolean
          id?: string
          metric_type: string
          name: string
          operator?: string
          severity?: string
          threshold: number
          updated_at?: string
          user_id: string
        }
        Update: {
          correlation_metric?: string | null
          correlation_operator?: string | null
          correlation_threshold?: number | null
          created_at?: string
          duration_seconds?: number
          enabled?: boolean
          id?: string
          metric_type?: string
          name?: string
          operator?: string
          severity?: string
          threshold?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          ai_message: string | null
          condition: Json
          created_at: string
          id: string
          message: string | null
          name: string
          resolved_at: string | null
          severity: string
          status: string
          triggered_at: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          ai_message?: string | null
          condition: Json
          created_at?: string
          id?: string
          message?: string | null
          name: string
          resolved_at?: string | null
          severity?: string
          status?: string
          triggered_at?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          ai_message?: string | null
          condition?: Json
          created_at?: string
          id?: string
          message?: string | null
          name?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          triggered_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_id?: string
        }
        Relationships: []
      }
      escalation_levels: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          id: string
          level_order: number
          notify_method: string
          policy_id: string
          schedule_id: string | null
          timeout_minutes: number
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          level_order?: number
          notify_method?: string
          policy_id: string
          schedule_id?: string | null
          timeout_minutes?: number
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          level_order?: number
          notify_method?: string
          policy_id?: string
          schedule_id?: string | null
          timeout_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "escalation_levels_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "escalation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_levels_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "oncall_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_policies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          repeat_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          repeat_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          repeat_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      incident_events: {
        Row: {
          description: string | null
          event_type: string
          id: string
          incident_id: string
          metadata: Json | null
          occurred_at: string
          severity: string
          title: string
        }
        Insert: {
          description?: string | null
          event_type: string
          id?: string
          incident_id: string
          metadata?: Json | null
          occurred_at?: string
          severity?: string
          title: string
        }
        Update: {
          description?: string | null
          event_type?: string
          id?: string
          incident_id?: string
          metadata?: Json | null
          occurred_at?: string
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          affected_services: string[] | null
          ai_analysis: Json | null
          created_at: string
          description: string | null
          id: string
          resolved_at: string | null
          severity: string
          started_at: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affected_services?: string[] | null
          ai_analysis?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          affected_services?: string[] | null
          ai_analysis?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      logs: {
        Row: {
          id: string
          message: string
          metadata: Json | null
          server_id: string
          service_id: string | null
          severity: string
          source: string | null
          span_id: string | null
          timestamp: string
          trace_id: string | null
        }
        Insert: {
          id?: string
          message: string
          metadata?: Json | null
          server_id: string
          service_id?: string | null
          severity?: string
          source?: string | null
          span_id?: string | null
          timestamp?: string
          trace_id?: string | null
        }
        Update: {
          id?: string
          message?: string
          metadata?: Json | null
          server_id?: string
          service_id?: string | null
          severity?: string
          source?: string | null
          span_id?: string | null
          timestamp?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics: {
        Row: {
          id: string
          metric_type: string
          recorded_at: string
          server_id: string
          service_id: string | null
          unit: string
          value: number
        }
        Insert: {
          id?: string
          metric_type: string
          recorded_at?: string
          server_id: string
          service_id?: string | null
          unit?: string
          value: number
        }
        Update: {
          id?: string
          metric_type?: string
          recorded_at?: string
          server_id?: string
          service_id?: string | null
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "metrics_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          metadata: Json | null
          read: boolean
          severity: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean
          severity?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean
          severity?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      oncall_members: {
        Row: {
          created_at: string
          id: string
          member_email: string | null
          member_name: string
          position: number
          schedule_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_email?: string | null
          member_name: string
          position?: number
          schedule_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_email?: string | null
          member_name?: string
          position?: number
          schedule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oncall_members_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "oncall_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      oncall_overrides: {
        Row: {
          created_at: string
          id: string
          member_id: string
          override_date: string
          reason: string | null
          schedule_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          override_date: string
          reason?: string | null
          schedule_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          override_date?: string
          reason?: string | null
          schedule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oncall_overrides_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "oncall_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oncall_overrides_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "oncall_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      oncall_schedules: {
        Row: {
          created_at: string
          current_index: number
          id: string
          last_rotated_at: string | null
          name: string
          rotation_interval_days: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_index?: number
          id?: string
          last_rotated_at?: string | null
          name: string
          rotation_interval_days?: number
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_index?: number
          id?: string
          last_rotated_at?: string | null
          name?: string
          rotation_interval_days?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      runbook_executions: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          incident_id: string | null
          runbook_id: string
          started_at: string
          status: string
          steps_completed: Json
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          incident_id?: string | null
          runbook_id: string
          started_at?: string
          status?: string
          steps_completed?: Json
          user_id: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          incident_id?: string | null
          runbook_id?: string
          started_at?: string
          status?: string
          steps_completed?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runbook_executions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runbook_executions_runbook_id_fkey"
            columns: ["runbook_id"]
            isOneToOne: false
            referencedRelation: "runbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      runbooks: {
        Row: {
          cooldown_minutes: number
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          last_triggered_at: string | null
          name: string
          steps: Json
          trigger_conditions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          cooldown_minutes?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          name: string
          steps?: Json
          trigger_conditions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          cooldown_minutes?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          name?: string
          steps?: Json
          trigger_conditions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      servers: {
        Row: {
          api_key: string | null
          created_at: string
          health_score: number
          hostname: string
          id: string
          ip_address: string | null
          metadata: Json | null
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          health_score?: number
          hostname: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          health_score?: number
          hostname?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_dependencies: {
        Row: {
          created_at: string
          id: string
          source_service_id: string
          target_service_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_service_id: string
          target_service_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_service_id?: string
          target_service_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_dependencies_source_service_id_fkey"
            columns: ["source_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_dependencies_target_service_id_fkey"
            columns: ["target_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          health_score: number
          id: string
          metadata: Json | null
          name: string
          server_id: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          health_score?: number
          id?: string
          metadata?: Json | null
          name: string
          server_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          health_score?: number
          id?: string
          metadata?: Json | null
          name?: string
          server_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      slo_definitions: {
        Row: {
          created_at: string
          id: string
          latency_threshold_ms: number | null
          name: string
          service_id: string
          slo_type: string
          target_percentage: number
          updated_at: string
          user_id: string
          window_days: number
        }
        Insert: {
          created_at?: string
          id?: string
          latency_threshold_ms?: number | null
          name: string
          service_id: string
          slo_type?: string
          target_percentage?: number
          updated_at?: string
          user_id: string
          window_days?: number
        }
        Update: {
          created_at?: string
          id?: string
          latency_threshold_ms?: number | null
          name?: string
          service_id?: string
          slo_type?: string
          target_percentage?: number
          updated_at?: string
          user_id?: string
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "slo_definitions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      status_page_config: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          logo_url: string | null
          page_description: string | null
          page_title: string
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          logo_url?: string | null
          page_description?: string | null
          page_title?: string
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          logo_url?: string | null
          page_description?: string | null
          page_title?: string
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      status_page_incidents: {
        Row: {
          created_at: string
          id: string
          message: string | null
          resolved_at: string | null
          severity: string
          started_at: string
          status: string
          status_page_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          status_page_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          status_page_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_page_incidents_status_page_id_fkey"
            columns: ["status_page_id"]
            isOneToOne: false
            referencedRelation: "status_page_config"
            referencedColumns: ["id"]
          },
        ]
      }
      status_page_services: {
        Row: {
          created_at: string
          display_name: string
          display_order: number
          id: string
          service_id: string
          status_page_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          display_order?: number
          id?: string
          service_id: string
          status_page_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          display_order?: number
          id?: string
          service_id?: string
          status_page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_page_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_page_services_status_page_id_fkey"
            columns: ["status_page_id"]
            isOneToOne: false
            referencedRelation: "status_page_config"
            referencedColumns: ["id"]
          },
        ]
      }
      traces: {
        Row: {
          duration_ms: number
          id: string
          metadata: Json | null
          operation_name: string
          parent_span_id: string | null
          service_id: string
          span_id: string
          started_at: string
          status: string
          trace_id: string
        }
        Insert: {
          duration_ms: number
          id?: string
          metadata?: Json | null
          operation_name: string
          parent_span_id?: string | null
          service_id: string
          span_id: string
          started_at?: string
          status?: string
          trace_id: string
        }
        Update: {
          duration_ms?: number
          id?: string
          metadata?: Json | null
          operation_name?: string
          parent_span_id?: string | null
          service_id?: string
          span_id?: string
          started_at?: string
          status?: string
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "traces_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_configs: {
        Row: {
          created_at: string
          enabled: boolean
          events: string[]
          id: string
          name: string
          secret: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          events?: string[]
          id?: string
          name: string
          secret?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          events?: string[]
          id?: string
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "viewer"
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
      app_role: ["admin", "viewer"],
    },
  },
} as const
