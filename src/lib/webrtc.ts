/**
 * WebRTC Configuration
 * Includes STUN and TURN servers for NAT traversal.
 * STUN is sufficient for users on same network or simple NATs.
 * TURN is REQUIRED for users on different networks (Firewalls/Symmetric NAT).
 */

export const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302',
                'stun:stun.services.mozilla.com',
            ],
        },
        // Using OpenRelay (free) to enable cross-network communication.
        // For production, consider a paid provider like Twilio, Cloudflare, or Metered.ca
        {
            urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turn:openrelay.metered.ca:1194',
                'turns:openrelay.metered.ca:443',
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
    ],
    iceCandidatePoolSize: 10,
};

/**
 * Common peer connection options
 * Using 'all' for iceTransportPolicy allows both relay (TURN) and host/srflx (STUN) candidates.
 */
export const PC_OPTIONS: RTCConfiguration = {
    ...ICE_SERVERS,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
};
