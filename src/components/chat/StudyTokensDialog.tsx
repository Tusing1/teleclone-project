import { useState } from 'react';
import {
  Coins, Gift, TrendingUp, History, Award, Zap, Users, Mic,
  Video, Bot, GamepadIcon, ShoppingCart, Smartphone, ExternalLink,
  Check, Copy, Phone
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { useStudyTokens, TOKEN_COSTS, TOKEN_REWARDS, TOKEN_PACKAGES } from '@/hooks/useStudyTokens';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface StudyTokensDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenBrowser?: (url: string) => void;
}

export function StudyTokensDialog({ open, onClose, onOpenBrowser }: StudyTokensDialogProps) {
  const {
    balance,
    totalEarned,
    transactions,
    streak,
    loading,
    unlockPremiumWithTokens,
    createPurchase,
    activateCode
  } = useStudyTokens();

  const [selectedPackage, setSelectedPackage] = useState<typeof TOKEN_PACKAGES[number] | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mtn' | 'airtel' | null>(null);
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const earnActivities = [
    { name: 'Daily Login', tokens: TOKEN_REWARDS.DAILY_LOGIN, icon: Zap, description: streak ? `${streak.current_streak} day streak!` : 'Come back daily' },
    { name: 'Invite a Friend', tokens: TOKEN_REWARDS.REFERRAL, icon: Users, description: 'When they sign up' },
    { name: 'Complete Profile', tokens: TOKEN_REWARDS.COMPLETE_PROFILE, icon: Award, description: 'Add bio & photo' },
    { name: 'Full Livestream', tokens: TOKEN_REWARDS.FULL_LIVESTREAM, icon: Video, description: 'Watch till end' },
    { name: 'Play a Game', tokens: TOKEN_REWARDS.PLAY_GAME, icon: GamepadIcon, description: 'Coming soon' },
    { name: 'Make 10 Friends', tokens: TOKEN_REWARDS.MAKE_10_FRIENDS, icon: Users, description: 'Milestone reward' },
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
    {
      name: 'Unlock AI Chat',
      cost: TOKEN_COSTS.UNLOCK_AI_CHAT,
      icon: Bot,
      key: 'UNLOCK_AI_CHAT' as const,
      description: 'Access the AI assistant'
    },
    {
      name: 'Longer Calls (2hr)',
      cost: TOKEN_COSTS.LONGER_CALLS,
      icon: Phone,
      key: 'LONGER_CALLS' as const,
      description: 'Extend call limit to 2 hours'
    },
  ];

  const handleUnlock = async (feature: keyof typeof TOKEN_COSTS) => {
    await unlockPremiumWithTokens(feature);
  };

  const handleSelectPackage = (pkg: typeof TOKEN_PACKAGES[number]) => {
    setSelectedPackage(pkg);
    setPaymentMethod(null);
    setActivationCode(null);
  };

  const handlePaymentMethod = async (method: 'mtn' | 'airtel') => {
    if (!selectedPackage) return;

    setPaymentMethod(method);
    setIsProcessing(true);

    // Create purchase and get activation code
    const result = await createPurchase(selectedPackage.tokens, selectedPackage.price, method);

    if (result) {
      setActivationCode(result.activationCode);

      // Build USSD string and open dialer
      const amount = selectedPackage.price;
      let ussdString = '';

      if (method === 'mtn') {
        ussdString = `tel:*165*1*1*0763442526*${amount}%23`;
      } else {
        ussdString = `tel:*185*1*1*0705612034*2*${amount}%23`;
      }

      // Open dialer
      window.location.href = ussdString;
    }

    setIsProcessing(false);
  };

  const handleCopyCode = () => {
    if (activationCode) {
      navigator.clipboard.writeText(activationCode);
      toast.success('Code copied!');
    }
  };

  const handleActivateCode = async () => {
    if (!codeInput.trim()) {
      toast.error('Please enter an activation code');
      return;
    }

    setIsProcessing(true);
    const success = await activateCode(codeInput.trim());
    if (success) {
      setCodeInput('');
      setSelectedPackage(null);
      setPaymentMethod(null);
      setActivationCode(null);
    }
    setIsProcessing(false);
  };

  const resetPurchaseFlow = () => {
    setSelectedPackage(null);
    setPaymentMethod(null);
    setActivationCode(null);
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
            {streak && streak.current_streak > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                🔥 {streak.current_streak} day streak
              </p>
            )}
          </div>
        </div>

        {/* Milestone Progress Tracker */}
        {streak && (
          <div className="bg-secondary/30 rounded-lg p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Streak Milestones</p>
            <div className="flex items-center gap-1">
              {[7, 14, 30].map((milestone, index) => {
                const isAchieved = streak.current_streak >= milestone;
                const isNext = !isAchieved && (index === 0 || streak.current_streak >= [7, 14, 30][index - 1]);
                const progress = isNext ? (streak.current_streak / milestone) * 100 : 0;
                const bonusTokens = milestone === 7 ? 25 : milestone === 14 ? 50 : 100;

                return (
                  <div key={milestone} className="flex-1">
                    <div className="relative">
                      <div className={`h-2 rounded-full ${isAchieved ? 'bg-green-500' : 'bg-secondary'}`}>
                        {isNext && (
                          <div
                            className="h-full bg-yellow-500 rounded-full transition-all"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="text-center mt-1">
                      <p className={`text-[10px] font-medium ${isAchieved ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {milestone} days
                      </p>
                      <p className={`text-[9px] ${isAchieved ? 'text-green-500' : 'text-muted-foreground'}`}>
                        +{bonusTokens} 🪙
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Tabs defaultValue="earn" className="mt-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="earn" className="text-xs">
              <Gift className="h-3 w-3 mr-1" />
              Earn
            </TabsTrigger>
            <TabsTrigger value="buy" className="text-xs">
              <ShoppingCart className="h-3 w-3 mr-1" />
              Buy
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

          <TabsContent value="buy" className="mt-3">
            <ScrollArea className="h-[250px]">
              {!selectedPackage ? (
                <div className="space-y-3">
                  {/* Token Packages */}
                  <p className="text-sm font-medium text-muted-foreground mb-2">Select a package:</p>
                  {TOKEN_PACKAGES.map((pkg) => (
                    <button
                      key={pkg.tokens}
                      onClick={() => handleSelectPackage(pkg)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-left"
                    >
                      <div className="p-2 rounded-full bg-yellow-500/20">
                        <Coins className="h-4 w-4 text-yellow-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{pkg.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {pkg.price.toLocaleString()} UGX
                        </p>
                      </div>
                      {pkg.savings && (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-600">
                          {pkg.savings}
                        </Badge>
                      )}
                    </button>
                  ))}

                  {/* Activation Code Input */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm font-medium mb-2">Have an activation code?</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code (e.g., TKX7M9)"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleActivateCode}
                        disabled={isProcessing || !codeInput.trim()}
                        size="sm"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Crypto Coming Soon */}
                  <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">₿</span>
                      <p className="font-medium text-sm">Pay with Crypto</p>
                      <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Create a Binance account to pay with crypto when available
                    </p>
                    <a
                      href="https://www.binance.com/activity/referral-entry/CPA?ref=CPA_00TLT5HT2T"
                      target={onOpenBrowser ? undefined : "_blank"}
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (onOpenBrowser) {
                          e.preventDefault();
                          onOpenBrowser("https://www.binance.com/activity/referral-entry/CPA?ref=CPA_00TLT5HT2T");
                        }
                      }}
                      className="inline-flex items-center gap-1 text-xs text-orange-500 hover:underline"
                    >
                      Create Binance Account
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium">{selectedPackage.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedPackage.price.toLocaleString()} UGX
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetPurchaseFlow}>
                      Change
                    </Button>
                  </div>

                  {/* Mobile Money Coming Soon */}
                  <div className="p-6 rounded-xl bg-gradient-to-r from-yellow-500/10 to-red-500/10 border border-yellow-500/20 text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-yellow-500/20 to-red-500/20 flex items-center justify-center mx-auto mb-4">
                      <Phone className="h-8 w-8 text-yellow-600" />
                    </div>
                    <h3 className="font-semibold mb-2">Mobile Money Coming Soon!</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      MTN MoMo and Airtel Money payments will be available very soon.
                    </p>
                    <Badge variant="outline" className="text-xs">
                      Coming Soon
                    </Badge>
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    For now, contact admin to get activation codes manually
                  </p>
                </div>
              )}
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
                      <div className={`p-2 rounded-full ${tx.transaction_type === 'earn'
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
                      <span className={`font-semibold ${tx.transaction_type === 'earn'
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
