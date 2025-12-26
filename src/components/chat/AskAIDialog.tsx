import { Bot, Sparkles, MessageSquare, Globe, BookOpen, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TOKEN_COSTS } from '@/hooks/useStudyTokens';

interface AskAIDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AskAIDialog({ open, onClose }: AskAIDialogProps) {
  const features = [
    { icon: BookOpen, title: 'Study Help', description: 'Get explanations for complex topics' },
    { icon: Globe, title: 'Translation', description: 'Translate text between languages' },
    { icon: MessageSquare, title: 'Writing Assistant', description: 'Help with essays and messages' },
    { icon: Sparkles, title: 'General Questions', description: 'Ask anything you want to know' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Ask AI Assistant
          </DialogTitle>
          <DialogDescription>
            Your personal AI helper for studying and more
          </DialogDescription>
        </DialogHeader>

        {/* Coming Soon Banner */}
        <div className="bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-xl p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Coming Soon!</h3>
          <p className="text-sm text-muted-foreground mb-4">
            We're building a powerful AI assistant just for you
          </p>
          <Badge variant="secondary" className="bg-primary/20 text-primary">
            Unlock for {TOKEN_COSTS.UNLOCK_AI_CHAT} 🪙
          </Badge>
        </div>

        {/* Feature Preview */}
        <div className="space-y-3 mt-4">
          <p className="text-sm font-medium text-muted-foreground">What you'll be able to do:</p>
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30"
            >
              <div className="p-2 rounded-full bg-primary/10">
                <feature.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{feature.title}</p>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        <Button className="w-full mt-4" disabled>
          <Lock className="h-4 w-4 mr-2" />
          Coming Soon
        </Button>
      </DialogContent>
    </Dialog>
  );
}
