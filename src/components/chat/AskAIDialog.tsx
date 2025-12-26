import { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles, Trash2, Coins, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAIChat } from '@/hooks/useAIChat';
import { cn } from '@/lib/utils';

interface AskAIDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AskAIDialog({ open, onClose }: AskAIDialogProps) {
  const {
    messages,
    isLoading,
    freeQuestionsRemaining,
    tokensPerQuestion,
    canAskQuestion,
    sendMessage,
    clearMessages,
    fetchUsage,
  } = useAIChat();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetchUsage();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, fetchUsage]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const suggestedQuestions = [
    "Explain photosynthesis simply",
    "Help me with math homework",
    "Translate this to French",
    "Write an essay introduction",
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              AI Study Assistant
            </div>
            <div className="flex items-center gap-2">
              {freeQuestionsRemaining > 0 ? (
                <Badge variant="secondary" className="bg-green-500/20 text-green-600">
                  {freeQuestionsRemaining} free left
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
                  <Coins className="h-3 w-3 mr-1" />
                  {tokensPerQuestion}/question
                </Badge>
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Ask AI questions about your studies
          </DialogDescription>
        </DialogHeader>

        {/* Messages area */}
        <ScrollArea 
          ref={scrollRef}
          className="flex-1 px-4"
        >
          <div className="py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary opacity-50" />
                <h3 className="font-medium mb-2">How can I help you today?</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  I can help with homework, explain topics, translate text, and more!
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {suggestedQuestions.map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto py-2 whitespace-normal text-left"
                      onClick={() => {
                        setInput(q);
                        inputRef.current?.focus();
                      }}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-3",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2 max-w-[80%]",
                      msg.role === 'user'
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="p-4 border-t">
          {messages.length > 0 && (
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                className="text-muted-foreground"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear chat
              </Button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={canAskQuestion ? "Ask me anything..." : "Need more tokens"}
              disabled={isLoading || !canAskQuestion}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading || !canAskQuestion}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          {!canAskQuestion && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Get more tokens to continue chatting
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
