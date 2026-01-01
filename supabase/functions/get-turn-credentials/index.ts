import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const METERED_API_KEY = Deno.env.get('METERED_API_KEY');

    // Use configured key or fallback to provided key
    const apiKey = METERED_API_KEY || '4602cf2044c45b6a125619fbe65069e42b52';

    if (!apiKey) {
      console.error('METERED_API_KEY is not configured');
      // Return fallback STUN-only configuration if no API key
      return new Response(JSON.stringify({
        iceServers: [
          {
            urls: [
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302',
              'stun:stun2.l.google.com:19302',
            ],
          },
        ],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching TURN credentials from Metered.ca...');

    // Fetch dynamic TURN credentials from Metered.ca
    const response = await fetch(
      `https://studdybuddyapp.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`
    );

    if (!response.ok) {
      console.error('Failed to fetch TURN credentials:', response.status, response.statusText);
      throw new Error(`Failed to fetch TURN credentials: ${response.status}`);
    }

    const iceServers = await response.json();
    console.log('Received TURN credentials:', JSON.stringify(iceServers).substring(0, 200));

    // Add Google STUN servers as fallback
    const fullConfig = {
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
          ],
        },
        ...iceServers,
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };

    return new Response(JSON.stringify(fullConfig), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching TURN credentials:', error);

    // Return fallback configuration with free TURN servers
    const fallbackConfig = {
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
          ],
        },
        // User's Metered.ca fallback (if dynamic fetch fails)
        {
          urls: [
            'turn:global.relay.metered.ca:80',
            'turn:global.relay.metered.ca:80?transport=tcp',
            'turn:global.relay.metered.ca:443',
            'turns:global.relay.metered.ca:443?transport=tcp',
          ],
          username: 'da73ef4f9a2521323f6c7d98',
          credential: 'bg4DqkRBQWOhnk5S',
        },
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };

    return new Response(JSON.stringify(fallbackConfig), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
