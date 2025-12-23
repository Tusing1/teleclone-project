import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  users: { userId: string; username: string }[];
  className?: string;
}

export function TypingIndicator({ users, className }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const text = users.length === 1
    ? `${users[0].username} is typing`
    : users.length === 2
      ? `${users[0].username} and ${users[1].username} are typing`
      : `${users[0].username} and ${users.length - 1} others are typing`;

  return (
    <div className={cn("flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground", className)}>
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing-dot" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing-dot" style={{ animationDelay: '200ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing-dot" style={{ animationDelay: '400ms' }} />
      </div>
      <span className="italic">{text}...</span>
    </div>
  );
}