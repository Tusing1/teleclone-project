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
  public: {
    Tables: {
      ai_usage: {
        Row: {
          created_at: string | null
          id: string
          last_reset: string | null
          question_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_reset?: string | null
          question_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_reset?: string | null
          question_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      call_participants: {
        Row: {
          call_id: string
          hand_raised: boolean | null
          id: string
          is_muted: boolean
          is_video_off: boolean
          joined_at: string
          left_at: string | null
          noise_suppression: boolean | null
          user_id: string
        }
        Insert: {
          call_id: string
          hand_raised?: boolean | null
          id?: string
          is_muted?: boolean
          is_video_off?: boolean
          joined_at?: string
          left_at?: string | null
          noise_suppression?: boolean | null
          user_id: string
        }
        Update: {
          call_id?: string
          hand_raised?: boolean | null
          id?: string
          is_muted?: boolean
          is_video_off?: boolean
          joined_at?: string
          left_at?: string | null
          noise_suppression?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_signals: {
        Row: {
          call_id: string
          created_at: string
          from_user: string
          id: string
          signal_data: Json
          signal_type: string
          to_user: string | null
        }
        Insert: {
          call_id: string
          created_at?: string
          from_user: string
          id?: string
          signal_data: Json
          signal_type: string
          to_user?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string
          from_user?: string
          id?: string
          signal_data?: Json
          signal_type?: string
          to_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          call_type: string
          conversation_id: string
          ended_at: string | null
          id: string
          is_active: boolean
          is_recording: boolean
          livestream_title: string | null
          recorded_by: string | null
          recording_title: string | null
          recording_url: string | null
          started_at: string
          started_by: string
        }
        Insert: {
          call_type?: string
          conversation_id: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          is_recording?: boolean
          livestream_title?: string | null
          recorded_by?: string | null
          recording_title?: string | null
          recording_url?: string | null
          started_at?: string
          started_by: string
        }
        Update: {
          call_type?: string
          conversation_id?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          is_recording?: boolean
          livestream_title?: string | null
          recorded_by?: string | null
          recording_title?: string | null
          recording_url?: string | null
          started_at?: string
          started_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_banned_users: {
        Row: {
          banned_at: string
          banned_by: string
          conversation_id: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_at?: string
          banned_by: string
          conversation_id: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_at?: string
          banned_by?: string
          conversation_id?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_banned_users_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_invite_links: {
        Row: {
          code: string
          conversation_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          name: string | null
          uses_count: number
        }
        Insert: {
          code?: string
          conversation_id: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name?: string | null
          uses_count?: number
        }
        Update: {
          code?: string
          conversation_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name?: string | null
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "channel_invite_links_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_archived: boolean | null
          linked_discussion_id: string | null
          name: string | null
          subscriber_count: number | null
          type: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          linked_discussion_id?: string | null
          name?: string | null
          subscriber_count?: number | null
          type?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          linked_discussion_id?: string | null
          name?: string | null
          subscriber_count?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_linked_discussion_id_fkey"
            columns: ["linked_discussion_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_restricted_members: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          reason: string | null
          restricted_by: string
          restricted_until: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          reason?: string | null
          restricted_by: string
          restricted_until?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          restricted_by?: string
          restricted_until?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_restricted_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          receiver_id: string
          responded_at: string | null
          sender_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          receiver_id: string
          responded_at?: string | null
          sender_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          receiver_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string | null
        }
        Relationships: []
      }
      interest_categories: {
        Row: {
          created_at: string
          emoji: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      invite_link_uses: {
        Row: {
          id: string
          invite_link_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          id?: string
          invite_link_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          id?: string
          invite_link_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_link_uses_invite_link_id_fkey"
            columns: ["invite_link_id"]
            isOneToOne: false
            referencedRelation: "channel_invite_links"
            referencedColumns: ["id"]
          },
        ]
      }
      login_streaks: {
        Row: {
          current_streak: number | null
          id: string
          last_login_date: string | null
          longest_streak: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          current_streak?: number | null
          id?: string
          last_login_date?: string | null
          longest_streak?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          current_streak?: number | null
          id?: string
          last_login_date?: string | null
          longest_streak?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_views: {
        Row: {
          id: string
          message_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_views_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          encryption_metadata: Json | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          is_encrypted: boolean | null
          is_read: boolean | null
          message_type: string
          reply_to_channel_message_id: string | null
          sender_id: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          encryption_metadata?: Json | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_encrypted?: boolean | null
          is_read?: boolean | null
          message_type?: string
          reply_to_channel_message_id?: string | null
          sender_id: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          encryption_metadata?: Json | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_encrypted?: boolean | null
          is_read?: boolean | null
          message_type?: string
          reply_to_channel_message_id?: string | null
          sender_id?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_channel_message_id_fkey"
            columns: ["reply_to_channel_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_unlocks: {
        Row: {
          can_see_likes: boolean
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          can_see_likes?: boolean
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          can_see_likes?: boolean
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          interests: string[] | null
          is_online: boolean | null
          last_seen: string | null
          phone_number: string | null
          referred_by: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          interests?: string[] | null
          is_online?: boolean | null
          last_seen?: string | null
          phone_number?: string | null
          referred_by?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          interests?: string[] | null
          is_online?: boolean | null
          last_seen?: string | null
          phone_number?: string | null
          referred_by?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_calls: {
        Row: {
          call_type: string
          conversation_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_cancelled: boolean
          scheduled_at: string
          title: string
        }
        Insert: {
          call_type?: string
          conversation_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_cancelled?: boolean
          scheduled_at: string
          title: string
        }
        Update: {
          call_type?: string
          conversation_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_cancelled?: boolean
          scheduled_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      study_tokens: {
        Row: {
          balance: number | null
          id: string
          total_earned: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          id?: string
          total_earned?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          id?: string
          total_earned?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      token_purchases: {
        Row: {
          activated_at: string | null
          activation_code: string
          amount_ugx: number
          created_at: string | null
          expires_at: string | null
          id: string
          payment_method: string
          status: string | null
          tokens: number
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          activation_code: string
          amount_ugx: number
          created_at?: string | null
          expires_at?: string | null
          id?: string
          payment_method: string
          status?: string | null
          tokens: number
          user_id: string
        }
        Update: {
          activated_at?: string | null
          activation_code?: string
          amount_ugx?: number
          created_at?: string | null
          expires_at?: string | null
          id?: string
          payment_method?: string
          status?: string | null
          tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      token_transactions: {
        Row: {
          activity_type: string
          amount: number
          created_at: string | null
          description: string | null
          id: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          activity_type: string
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          activity_type?: string
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_encryption_keys: {
        Row: {
          created_at: string
          id: string
          key_created_at: string
          public_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_created_at?: string
          public_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_created_at?: string
          public_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_matches: {
        Row: {
          conversation_id: string | null
          id: string
          matched_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          conversation_id?: string | null
          id?: string
          matched_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          conversation_id?: string | null
          id?: string
          matched_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_matches_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_referrals: {
        Row: {
          created_at: string | null
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_swipes: {
        Row: {
          created_at: string
          direction: string
          id: string
          swiped_id: string
          swiper_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          swiped_id: string
          swiper_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          swiped_id?: string
          swiper_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_invite_by_code: {
        Args: { invite_code: string }
        Returns: {
          code: string
          conversation_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          name: string | null
          uses_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "channel_invite_links"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_invite_details: { Args: { invite_code: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_user_relationship: {
        Args: { _profile_user_id: string; _viewer_id: string }
        Returns: boolean
      }
      increment_view_count: {
        Args: { message_id: string; viewer_id: string }
        Returns: undefined
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      join_channel_with_invite_code: {
        Args: { invite_code: string }
        Returns: Json
      }
      record_message_view: {
        Args: { p_message_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
