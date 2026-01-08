import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useEncryption } from '@/hooks/useEncryption';
import { toast } from 'sonner';
import { Shield, ShieldCheck } from 'lucide-react';

/**
 * Component that automatically initializes E2EE encryption for the user.
 * Should be placed high in the component tree after authentication.
 */
export const EncryptionInitializer: React.FC = () => {
  const { user } = useAuth();
  const { isInitialized, isLoading, initializeEncryption, error } = useEncryption();
  const [hasAttempted, setHasAttempted] = useState(false);

  useEffect(() => {
    const initEncryption = async () => {
      if (!user || isInitialized || isLoading || hasAttempted) return;
      
      setHasAttempted(true);
      console.log('🔐 Initializing E2EE encryption...');
      
      const success = await initializeEncryption();
      
      if (success) {
        console.log('🔐 E2EE encryption ready');
        // Only show toast on first-time setup, not on reload
        const isFirstTime = !localStorage.getItem(`e2ee_setup_${user.id}`);
        if (isFirstTime) {
          localStorage.setItem(`e2ee_setup_${user.id}`, 'true');
          toast.success('End-to-end encryption enabled', {
            description: 'Your direct messages are now encrypted',
            icon: <ShieldCheck className="h-4 w-4 text-green-500" />,
            duration: 4000,
          });
        }
      } else if (error) {
        console.error('E2EE initialization failed:', error);
      }
    };

    initEncryption();
  }, [user, isInitialized, isLoading, hasAttempted, initializeEncryption, error]);

  // This component doesn't render anything visible
  return null;
};

export default EncryptionInitializer;
