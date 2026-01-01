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
        // OpenRelay as fallback TURN
        {
            urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turns:openrelay.metered.ca:443',
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject',
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
export async function getTurnCredentials(): Promise<RTCConfiguration> {
    const now = Date.now();
    
    // Return cached config if still valid
    if (cachedConfig && now < cacheExpiry) {
        console.log('📡 Using cached TURN credentials');
        return cachedConfig;
    }
    
    try {
        console.log('📡 Fetching fresh TURN credentials...');
        const { data, error } = await supabase.functions.invoke('get-turn-credentials');
        
        if (error) {
            console.error('Failed to fetch TURN credentials:', error);
            return FALLBACK_ICE_SERVERS;
        }
        
        if (data && data.iceServers) {
            console.log('📡 Received TURN credentials with', data.iceServers.length, 'servers');
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
