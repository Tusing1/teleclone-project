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
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302',
            ],
        },
        // Optional: Add TURN servers here for "long-distance" calls.
        // Using OpenRelay (free) to enable cross-network communication.
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
 */
export const PC_OPTIONS: RTCConfiguration = {
    ...ICE_SERVERS,
    // Force ICE connection to be established even if local candidate fails
    iceTransportPolicy: 'all',
};
