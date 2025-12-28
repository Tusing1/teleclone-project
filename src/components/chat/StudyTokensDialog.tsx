import { useState } from 'react';
import {
  Coins, Gift, TrendingUp, History, Award, Zap, Users, Mic,
  Video, Bot, GamepadIcon, ShoppingCart, Smartphone, ExternalLink,
  Check, Copy, Phone, BarChart3, Info, Flame, ChevronRight
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
    globalStats,
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
    { name: 'Daily Login', tokens: TOKEN_REWARDS.DAILY_LOGIN, icon: Zap, description: streak ? `${streak.current_streak} day streak!` : 'Come back daily', color: 'text-amber-400' },
    { name: 'Invite a Friend', tokens: TOKEN_REWARDS.REFERRAL, icon: Users, description: 'When they sign up', color: 'text-sky-400' },
    { name: 'Complete Profile', tokens: TOKEN_REWARDS.COMPLETE_PROFILE, icon: Award, description: 'Add bio & photo', color: 'text-emerald-400' },
    { name: 'Full Livestream', tokens: TOKEN_REWARDS.FULL_LIVESTREAM, icon: Video, description: 'Watch till end', color: 'text-rose-400' },
    { name: 'Play a Game', tokens: TOKEN_REWARDS.PLAY_GAME, icon: GamepadIcon, description: 'Coming soon', color: 'text-purple-400' },
    { name: 'Make 10 Friends', tokens: TOKEN_REWARDS.MAKE_10_FRIENDS, icon: Users, description: 'Milestone reward', color: 'text-indigo-400' },
    { name: 'Ask AI', tokens: TOKEN_REWARDS.ASK_AI, icon: Bot, description: 'Earn by helping', color: 'text-primary' },
  ];

  const premiumFeatures = [
    {
      name: 'See Who Likes You',
      cost: TOKEN_COSTS.SEE_WHO_LIKES_WEEKLY,
      icon: Users,
      key: 'SEE_WHO_LIKES_WEEKLY' as const,
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
      name: 'Unlimited AI Chat',
      cost: TOKEN_COSTS.UNLIMITED_AI,
      icon: Bot,
      key: 'UNLIMITED_AI' as const,
      description: 'No limits on AI mentions'
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
      description: 'Higher daily free limits'
    },
    {
      name: 'Unlock AI Chat',
      cost: TOKEN_COSTS.UNLOCK_AI_CHAT,
      icon: Bot,
      key: 'UNLOCK_AI_CHAT' as const,
      description: 'Standard AI access'
    },
  ];

  const handleUnlock = async (feature: keyof typeof TOKEN_COSTS) => {
    await unlockPremiumWithTokens(feature);
  };

  const renderTokenomicsChart = () => {
    if (!globalStats) return null;
    const supply = globalStats.supply || 1000;
    const burnt = globalStats.burnt || 200;
    const burntPercent = Math.min((burnt / supply) * 100, 100);
    const circulating = supply - burnt;
    const circulatingPercent = 100 - burntPercent;

    return (
      <div className="space-y-4 p-4 bg-slate-900/50 rounded-2xl border border-white/5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Token Supply & Burn
          </h4>
          <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/20 text-primary">
            Value: {globalStats.value.toFixed(2)}x
          </Badge>
        </div>

        <div className="relative h-6 w-full bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-primary to-sky-500 transition-all duration-1000"
            style={{ width: `${circulatingPercent}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-orange-500 transition-all duration-1000"
            style={{ width: `${burntPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Circulating</p>
            </div>
            <p className="text-lg font-bold">{circulating.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-rose-500" />
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total Burnt</p>
            </div>
            <p className="text-lg font-bold">{burnt.toLocaleString()}</p>
          </div>
        </div>

        <div className="pt-2 border-t border-white/5">
          <p className="text-[10px] text-slate-400 italic">
            * Burn rate increases token value over time by reducing supply.
          </p>
        </div>
      </div>
    );
  };

  const handleActivateCode = async () => {
    if (!codeInput.trim()) {
      toast.error('Please enter an activation code');
      return;
    }
    setIsProcessing(true);
    const success = await activateCode(codeInput.trim());
    if (success) setCodeInput('');
    setIsProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] bg-slate-950 border-slate-800 text-white overflow-hidden p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-xl font-bold">Study Tokens</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-slate-400 text-sm">
            Earn tokens by being active. Spend them on premium features!
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Enhanced Balance Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-[2rem] border border-white/10 shadow-2xl">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Coins className="w-24 h-24" />
            </div>
            <div className="relative z-10 flex justify-between items-end">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Current Balance</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                    {balance}
                  </span>
                  <span className="text-lg font-bold text-amber-500/50">TK</span>
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20">
                  <TrendingUp className="h-3 w-3" />
                  <span className="text-xs font-black">{totalEarned}</span>
                </div>
                {streak && (
                  <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-400 px-3 py-1 rounded-full border border-orange-500/20">
                    <Flame className="h-3 w-3" />
                    <span className="text-xs font-black">{streak.current_streak} days</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Tabs defaultValue="earn" className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-slate-900/50 p-1 rounded-2xl border border-white/5 mb-6">
              <TabsTrigger value="earn" className="rounded-xl data-[state=active]:bg-primary"><Gift className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="buy" className="rounded-xl data-[state=active]:bg-primary"><ShoppingCart className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="spend" className="rounded-xl data-[state=active]:bg-primary"><Zap className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="tokenomics" className="rounded-xl data-[state=active]:bg-primary"><BarChart3 className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="history" className="rounded-xl data-[state=active]:bg-primary"><History className="h-4 w-4" /></TabsTrigger>
            </TabsList>

            <TabsContent value="earn" className="space-y-4 outline-none">
              <div className="grid gap-2">
                {earnActivities.map((activity) => (
                  <div key={activity.name} className="flex items-center gap-4 p-4 rounded-[1.5rem] bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-white/10 group cursor-pointer">
                    <div className={`w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <activity.icon className={`h-5 w-5 ${activity.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm tracking-tight">{activity.name}</p>
                      <p className="text-xs text-slate-500">{activity.description}</p>
                    </div>
                    <div className="bg-amber-500/10 text-amber-500 px-3 py-1.5 rounded-xl font-black text-xs border border-amber-500/20">
                      +{activity.tokens} TK
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="tokenomics" className="space-y-6 outline-none">
              {renderTokenomicsChart()}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-primary italic uppercase tracking-wider">How to increase value?</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Study Tokens gain value when they are **burnt** (spent). When supply decreases, the utility of each token increases. Be part of the ecosystem by using tokens for premium features!
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="spend" className="space-y-3 outline-none">
              <div className="grid gap-3">
                {premiumFeatures.map((feature) => (
                  <div key={feature.name} className="flex items-center gap-4 p-4 rounded-[1.5rem] bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm tracking-tight truncate">{feature.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{feature.description}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleUnlock(feature.key as any)}
                      disabled={balance < feature.cost}
                      className={`rounded-xl font-black text-xs h-9 px-4 ${balance >= feature.cost ? 'bg-primary hover:bg-primary/80' : 'bg-slate-800 text-slate-500'}`}
                    >
                      {feature.cost} 🪙
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="buy" className="space-y-4 outline-none">
              <div className="grid grid-cols-2 gap-3">
                {TOKEN_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.tokens}
                    onClick={() => setSelectedPackage(pkg as any)}
                    className="p-4 rounded-3xl bg-slate-900 border border-white/10 hover:border-primary/50 transition-all text-left relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 rotate-12 group-hover:scale-[2] transition-transform">
                      <Coins className="w-16 h-16" />
                    </div>
                    <p className="text-xs font-black text-primary mb-1">{pkg.label}</p>
                    <p className="text-lg font-black tracking-tighter">UGX {pkg.price.toLocaleString()}</p>
                    {pkg.savings && (
                      <Badge className="absolute top-2 right-2 bg-emerald-500 text-[8px] font-black px-1.5 py-0 shadow-lg">
                        {pkg.savings}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-white/5">
                <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">Activation Code</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="E.G. TK7M9X"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    className="flex-1 bg-slate-900 border-white/10 rounded-xl font-mono"
                  />
                  <Button
                    onClick={handleActivateCode}
                    disabled={isProcessing || !codeInput.trim()}
                    className="bg-primary rounded-xl px-4"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="outline-none">
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${tx.transaction_type === 'earn' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {tx.transaction_type === 'earn' ? <ChevronRight className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rotate-90" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs truncate">{tx.description || tx.activity_type}</p>
                        <p className="text-[10px] text-slate-500">{format(new Date(tx.created_at), 'MMM d, h:mm a')}</p>
                      </div>
                      <span className={`font-black text-sm ${tx.transaction_type === 'earn' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tx.transaction_type === 'earn' ? '+' : ''}{tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

