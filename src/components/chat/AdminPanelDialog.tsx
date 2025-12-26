import { useState, useEffect } from 'react';
import { 
  Shield, Check, X, Clock, Coins, User, Phone, RefreshCw 
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
import { useAdmin } from '@/hooks/useAdmin';
import { format, differenceInSeconds } from 'date-fns';

interface AdminPanelDialogProps {
  open: boolean;
  onClose: () => void;
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const diff = differenceInSeconds(new Date(expiresAt), new Date());
      return Math.max(0, diff);
    };

    setTimeLeft(calculateTimeLeft());
    
    const interval = setInterval(() => {
      const newTime = calculateTimeLeft();
      setTimeLeft(newTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  if (timeLeft <= 0) {
    return <Badge variant="destructive" className="text-xs">Expired</Badge>;
  }

  return (
    <Badge 
      variant={timeLeft <= 30 ? "destructive" : "secondary"} 
      className="text-xs font-mono"
    >
      <Clock className="h-3 w-3 mr-1" />
      {minutes}:{seconds.toString().padStart(2, '0')}
    </Badge>
  );
}

export function AdminPanelDialog({ open, onClose }: AdminPanelDialogProps) {
  const { 
    isAdmin, 
    loading, 
    pendingPurchases, 
    activatePurchase, 
    rejectPurchase,
    refetch 
  } = useAdmin();

  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleActivate = async (purchaseId: string) => {
    setProcessingId(purchaseId);
    await activatePurchase(purchaseId);
    setProcessingId(null);
  };

  const handleReject = async (purchaseId: string) => {
    setProcessingId(purchaseId);
    await rejectPurchase(purchaseId);
    setProcessingId(null);
  };

  if (!isAdmin) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              Access Denied
            </DialogTitle>
            <DialogDescription>
              You don't have admin privileges to access this panel.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Admin Panel
          </DialogTitle>
          <DialogDescription>
            Verify and activate mobile money payments
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {pendingPurchases.length} pending
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : pendingPurchases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Coins className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No pending payments</p>
              <p className="text-xs mt-1">All payments have been processed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingPurchases.map((purchase) => (
                <div 
                  key={purchase.id}
                  className="p-4 rounded-lg bg-secondary/30 border border-border"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-full ${
                        purchase.payment_method === 'mtn' 
                          ? 'bg-yellow-500/20' 
                          : 'bg-red-500/20'
                      }`}>
                        <Phone className={`h-4 w-4 ${
                          purchase.payment_method === 'mtn' 
                            ? 'text-yellow-500' 
                            : 'text-red-500'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {purchase.payment_method.toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {purchase.profile?.username || 'Unknown user'}
                        </p>
                      </div>
                    </div>
                    <CountdownTimer expiresAt={purchase.expires_at} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Tokens</p>
                      <p className="font-semibold text-yellow-500">
                        {purchase.tokens} 🪙
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="font-semibold">
                        {purchase.amount_ugx.toLocaleString()} UGX
                      </p>
                    </div>
                  </div>

                  <div className="bg-background rounded-lg p-2 mb-3">
                    <p className="text-xs text-muted-foreground mb-1">Activation Code</p>
                    <p className="font-mono text-lg font-bold tracking-wider">
                      {purchase.activation_code}
                    </p>
                  </div>

                  <div className="text-xs text-muted-foreground mb-3">
                    Created: {format(new Date(purchase.created_at), 'MMM d, h:mm a')}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleActivate(purchase.id)}
                      disabled={processingId === purchase.id}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Activate
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleReject(purchase.id)}
                      disabled={processingId === purchase.id}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}