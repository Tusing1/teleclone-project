import { readFileSync } from 'node:fs';
import { ECDH } from 'node:crypto';

// Read-only diagnostics. Never log publishable keys, VAPID keys or TURN credentials.
const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).flatMap(line => {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  return match ? [[match[1], match[2].trim().replace(/^["']|["']$/g, '')]] : [];
}));
const base = env.VITE_SUPABASE_URL;
if (!base || !env.VITE_SUPABASE_PUBLISHABLE_KEY) throw new Error('Missing public Supabase configuration');
for (const name of ['get-vapid-key', 'get-turn-credentials', 'send-push-notification']) {
  try {
    const response = await fetch(base + '/functions/v1/' + name, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = await response.json();
    let validVapid = false;
    if (typeof data.vapidPublicKey === 'string') {
      try { validVapid = ECDH.convertKey(Buffer.from(data.vapidPublicKey, 'base64url'), 'prime256v1').length === 65; } catch {}
    }
    console.log(JSON.stringify({ function: name, status: response.status,
      ...(name === 'get-vapid-key' ? { validPublicKey: validVapid } : name === 'send-push-notification' ? {
        requiresSignIn: response.status === 401,
      } : {
        relayAvailable: Array.isArray(data.iceServers) && data.iceServers.some(server => [server.urls].flat().some(url => typeof url === 'string' && /^turns?:/.test(url))),
        requiresSignIn: response.status === 401,
        serverCount: data.iceServers?.length || 0,
      }),
    }));
  } catch { console.log(JSON.stringify({ function: name, error: 'Network or endpoint unavailable' })); }
}
