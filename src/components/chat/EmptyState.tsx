import { MessageCircle } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-chat-bg">
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <MessageCircle className="w-12 h-12 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Select a chat to start messaging
      </h2>
      <p className="text-muted-foreground text-center max-w-sm">
        Choose a conversation from the list or start a new chat with the pencil icon
      </p>
    </div>
  );
}