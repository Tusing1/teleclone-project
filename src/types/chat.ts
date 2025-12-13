export interface Profile {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  last_seen: string | null;
  is_online: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  type: string;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_archived?: boolean;
  linked_discussion_id?: string | null;
  subscriber_count?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'image' | 'file';
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationWithDetails extends Conversation {
  participants: (ConversationParticipant & { profile: Profile })[];
  lastMessage?: Message;
  unreadCount?: number;
  isSavedMessages?: boolean;
  is_archived?: boolean;
}

export interface MessageWithSender extends Message {
  sender: Profile;
}