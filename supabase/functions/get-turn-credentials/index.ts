import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Sign in before calling' }, 401);
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return reply({ error: 'Sign in before calling' }, 401);
    const keys = [Deno.env.get('METERED_API_KEY'), Deno.env.get('METERED_API_KEY2')].filter((key): key is string => !!key);
    if (!keys.length) return reply({ error: 'Relay service is not configured', code: 'TURN_NOT_CONFIGURED' }, 503);
    const domain = Deno.env.get('METERED_DOMAIN') || 'studdybuddyapp.metered.live';
    // Only the relay provider is contacted; never accept a caller-supplied URL.
    if (!/^[a-z0-9-]+\.metered\.live$/i.test(domain)) return reply({ error: 'Invalid relay domain configuration' }, 503);
    for (const key of keys) {
      try {
        const response = await fetch('https://' + domain + '/api/v1/turn/credentials?apiKey=' + encodeURIComponent(key), { signal: AbortSignal.timeout(5000), redirect: 'error' });
        if (!response.ok) continue;
        const body = await response.json();
        const candidates = Array.isArray(body) ? body : body?.iceServers;
        if (!Array.isArray(candidates)) continue;
        const iceServers = candidates.filter(server => {
          const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
          return urls.length && urls.every((url: unknown) => typeof url === 'string' && /^(stun|turn|turns):/.test(url));
        });
        if (!iceServers.some(server => [server.urls].flat().some(url => /^turns?:/.test(url)) && server.username && server.credential)) continue;
        return reply({
          iceServers: [...iceServers, { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
          iceCandidatePoolSize: 10, iceTransportPolicy: 'all', bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require',
        });
      } catch { /* Try the configured backup without exposing provider errors or keys. */ }
    }
    return reply({ error: 'Relay service is unavailable', code: 'TURN_UNAVAILABLE' }, 503);
  } catch {
    return reply({ error: 'Relay service is unavailable', code: 'TURN_UNAVAILABLE' }, 503);
  }
});
