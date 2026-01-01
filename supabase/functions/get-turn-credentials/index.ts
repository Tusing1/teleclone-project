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
    
    if (!METERED_API_KEY) {
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
      `https://studybuddy.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
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
        // Fallback to OpenRelay (may have limited availability)
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
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };
    
    return new Response(JSON.stringify(fallbackConfig), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
