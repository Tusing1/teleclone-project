import { Coins, Gift, TrendingUp, History, Award, Zap, Users, Mic, Video, Bot, GamepadIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStudyTokens, TOKEN_COSTS, TOKEN_REWARDS } from '@/hooks/useStudyTokens';
import { format } from 'date-fns';

interface StudyTokensDialogProps {
  open: boolean;
  onClose: () => void;
}

export function StudyTokensDialog({ open, onClose }: StudyTokensDialogProps) {
  const { balance, totalEarned, transactions, loading, unlockPremiumWithTokens } = useStudyTokens();

  const earnActivities = [
    { name: 'Invite a Friend', tokens: TOKEN_REWARDS.REFERRAL, icon: Users, description: 'When they sign up' },
    { name: 'Complete Profile', tokens: TOKEN_REWARDS.COMPLETE_PROFILE, icon: Award, description: 'Add bio & photo' },
    { name: 'Full Livestream', tokens: TOKEN_REWARDS.FULL_LIVESTREAM, icon: Video, description: 'Watch till end' },
    { name: 'Play a Game', tokens: TOKEN_REWARDS.PLAY_GAME, icon: GamepadIcon, description: 'Coming soon' },
    { name: 'Make 10 Friends', tokens: TOKEN_REWARDS.MAKE_10_FRIENDS, icon: Users, description: 'Milestone reward' },
    { name: 'Daily Login', tokens: TOKEN_REWARDS.DAILY_LOGIN, icon: Zap, description: '7 day streak = 35' },
    { name: 'Ask AI', tokens: TOKEN_REWARDS.ASK_AI, icon: Bot, description: 'Coming soon' },
  ];

  const premiumFeatures = [
    { 
      name: 'See Who Likes You', 
      cost: TOKEN_COSTS.SEE_WHO_LIKES, 
      icon: Users, 
      key: 'SEE_WHO_LIKES' as const,
      description: 'View profiles of people who liked you'
    },
    { 
      name: '1 Week Premium', 
      cost: TOKEN_COSTS.ONE_WEEK_PREMIUM, 
      icon: Award, 
      key: 'ONE_WEEK_PREMIUM' as const,
      description: 'All premium features for 7 days'
    },
    { 
      name: 'Record Calls', 
      cost: TOKEN_COSTS.RECORD_CALLS, 
      icon: Mic, 
      key: 'RECORD_CALLS' as const,
      description: 'Save personal call recordings'
    },
    { 
      name: 'Extended AI Usage', 
      cost: TOKEN_COSTS.EXTENDED_AI, 
      icon: Bot, 
      key: 'EXTENDED_AI' as const,
      description: 'Higher AI usage limits'
    },
  ];

  const handleUnlock = async (feature: keyof typeof TOKEN_COSTS) => {
    await unlockPremiumWithTokens(feature);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            Study Tokens
          </DialogTitle>
          <DialogDescription>
            Earn tokens by being active. Spend them on premium features!
          </DialogDescription>
        </DialogHeader>

        {/* Balance display */}
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-3xl font-bold text-yellow-500">{balance}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Earned</p>
            <p className="text-xl font-semibold flex items-center gap-1 justify-end">
              <TrendingUp className="h-4 w-4 text-green-500" />
              {totalEarned}
            </p>
          </div>
        </div>

        <Tabs defaultValue="earn" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="earn" className="text-xs">
              <Gift className="h-3 w-3 mr-1" />
              Earn
            </TabsTrigger>
            <TabsTrigger value="spend" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Spend
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              <History className="h-3 w-3 mr-1" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="earn" className="mt-3">
            <ScrollArea className="h-[250px]">
              <div className="space-y-2">
                {earnActivities.map((activity) => (
                  <div 
                    key={activity.name}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="p-2 rounded-full bg-yellow-500/20">
                      <activity.icon className="h-4 w-4 text-yellow-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{activity.name}</p>
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                    </div>
                    <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
                      +{activity.tokens}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="spend" className="mt-3">
            <ScrollArea className="h-[250px]">
              <div className="space-y-2">
                {premiumFeatures.map((feature) => (
                  <div 
                    key={feature.name}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30"
                  >
                    <div className="p-2 rounded-full bg-primary/20">
                      <feature.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{feature.name}</p>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={balance >= feature.cost ? "default" : "secondary"}
                      disabled={balance < feature.cost}
                      onClick={() => handleUnlock(feature.key)}
                      className="text-xs"
                    >
                      {feature.cost} 🪙
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="mt-3">
            <ScrollArea className="h-[250px]">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading...
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No transactions yet</p>
                  <p className="text-xs mt-1">Start earning tokens!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div 
                      key={tx.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30"
                    >
                      <div className={`p-2 rounded-full ${
                        tx.transaction_type === 'earn' 
                          ? 'bg-green-500/20' 
                          : 'bg-red-500/20'
                      }`}>
                        {tx.transaction_type === 'earn' ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <Zap className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {tx.description || tx.activity_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      <span className={`font-semibold ${
                        tx.transaction_type === 'earn' 
                          ? 'text-green-500' 
                          : 'text-red-500'
                      }`}>
                        {tx.transaction_type === 'earn' ? '+' : ''}{tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
