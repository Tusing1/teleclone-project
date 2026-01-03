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
    const apiKeys = [
      Deno.env.get('METERED_API_KEY'),
      Deno.env.get('METERED_API_KEY2'),
    ].filter((v): v is string => Boolean(v));

    const domain = Deno.env.get('METERED_DOMAIN') || 'studdybuddyapp.metered.live';

    if (apiKeys.length === 0) {
      console.error('Metered API key is not configured');
      // Return fallback STUN-only configuration if no API key
      return new Response(
        JSON.stringify({
          iceServers: [
            {
              urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
              ],
            },
          ],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let response: Response | null = null;
    let usedKeyIndex = 0;

    for (let i = 0; i < apiKeys.length; i++) {
      const key = apiKeys[i];
      usedKeyIndex = i;

      console.log(`Fetching TURN credentials from Metered.ca domain: ${domain} (key ${i + 1}/${apiKeys.length})`);

      response = await fetch(
        `https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`
      );

      if (response.ok) break;

      console.error('Failed to fetch TURN credentials:', response.status, response.statusText);

      // If the first key is invalid (401) and we have a second key, try the next.
      if (response.status === 401 && i < apiKeys.length - 1) {
        console.warn('Metered API key returned 401, trying next key...');
        continue;
      }

      // For other errors, still try next key if available.
      if (i < apiKeys.length - 1) continue;
    }

    if (!response || !response.ok) {
      throw new Error(`Failed to fetch TURN credentials: ${response?.status ?? 'no response'}`);
    }

    const meterIceServers = await response.json();
    const iceServers = Array.isArray(meterIceServers) ? meterIceServers : (meterIceServers?.iceServers ?? []);

    console.log('Received TURN credentials count:', Array.isArray(iceServers) ? iceServers.length : 0, `(used key ${usedKeyIndex + 1}/${apiKeys.length})`);

    const fullConfig = {
      iceServers: [
        ...(Array.isArray(iceServers) ? iceServers : []),
        {
          urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
        },
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };

    return new Response(JSON.stringify(fullConfig), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error fetching TURN credentials:', error);

    // Return fallback STUN-only configuration if dynamic fetch fails
    const fallbackConfig = {
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
          ],
        },
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };

    return new Response(JSON.stringify(fallbackConfig), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }
});
