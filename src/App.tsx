import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { GlobalAudioProvider } from "@/hooks/useGlobalAudio";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Install from "./pages/Install";
import Invite from "./pages/Invite";
import HelpSupport from "./pages/HelpSupport";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import { useEffect, lazy, Suspense } from "react";
import { IncomingCallListener } from "@/components/chat/IncomingCallListener";

const queryClient = new QueryClient();
const CallPreview = import.meta.env.DEV ? lazy(() => import('./pages/CallPreview')) : null;



const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <GlobalAudioProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <IncomingCallListener />
              <Routes>
                {CallPreview && <Route path="/__call-preview" element={<Suspense fallback={null}><CallPreview /></Suspense>} />}
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/invite/:code" element={<Invite />} />
                <Route path="/install" element={<Install />} />
                <Route path="/help" element={<HelpSupport />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </GlobalAudioProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
