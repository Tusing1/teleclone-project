/**
 * WebRTC Configuration
 * Includes STUN and TURN servers for NAT traversal.
 * STUN is sufficient for users on same network or simple NATs.
 * TURN is REQUIRED for users on different networks (Firewalls/Symmetric NAT).
 */

import { supabase } from '@/integrations/supabase/client';

// Fallback configuration if dynamic fetch fails
export const FALLBACK_ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302',
            ],
        },
    ],
    iceCandidatePoolSize: 10,
};

// Cache for TURN credentials (expires after 5 minutes)
let cachedConfig: RTCConfiguration | null = null;
let cacheExpiry = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches fresh TURN credentials from the edge function.
 * Uses caching to avoid excessive API calls.
 * Falls back to static configuration if fetch fails.
 */
export async function getTurnCredentials(forceRefresh: boolean = false): Promise<RTCConfiguration> {
    const now = Date.now();

    // Return cached config if still valid
    if (!forceRefresh && cachedConfig && now < cacheExpiry) {
        console.log('📡 Using cached TURN credentials');
        return cachedConfig;
    }

    try {
        console.log(forceRefresh ? '📡 Force-refreshing TURN credentials...' : '📡 Fetching fresh TURN credentials...');
        const { data, error } = await supabase.functions.invoke('get-turn-credentials');

        if (error) {
            console.error('Failed to fetch TURN credentials:', error);
            return FALLBACK_ICE_SERVERS;
        }

        if (data && data.iceServers) {
            const servers = (data.iceServers as any[]) ?? [];
            const hasTurn = servers.some((s) => {
                const urls = Array.isArray((s as any).urls) ? (s as any).urls : [(s as any).urls];
                return urls.some((u: unknown) => typeof u === 'string' && (u.startsWith('turn:') || u.startsWith('turns:')));
            });

            console.log('📡 Received TURN credentials with', servers.length, 'servers', hasTurn ? '(TURN enabled)' : '(STUN-only)');

            cachedConfig = data as RTCConfiguration;
            cacheExpiry = now + CACHE_DURATION;
            return cachedConfig;
        }

        console.warn('Invalid TURN credentials response, using fallback');
        return FALLBACK_ICE_SERVERS;
    } catch (err) {
        console.error('Error fetching TURN credentials:', err);
        return FALLBACK_ICE_SERVERS;
    }
}

// Legacy exports for backward compatibility (will use fallback)
export const ICE_SERVERS: RTCConfiguration = FALLBACK_ICE_SERVERS;

export const PC_OPTIONS: RTCConfiguration = {
    ...FALLBACK_ICE_SERVERS,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
};
