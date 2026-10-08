# StudyGram: deploy only two prepared backend functions

Target: existing StudyGram Lovable Cloud project dbf08cab-e16f-4f05-bdd5-95fcc19c7c7b, backend plhzfgfrlxywxaccewyh.

Replace and deploy only the two function sources below. These exact sources have local handler tests passing; they still require edge-runtime verification. Do not rewrite the frontend, publish the site, change the backend URL, create a replacement project, modify database policies, replay migrations, rotate/reveal secrets, remove other functions, or send real calls/pushes to users. The two channel/comment/call migrations 20261007120000 and 20261007200000 were already applied and recorded through SQL editor.

Preserve existing METERED_API_KEY, METERED_API_KEY2, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY. Their names were checked in Cloud; do not display values. Supabase runtime variables remain server-only. METERED_DOMAIN is optional; the source defaults to studdybuddyapp.metered.live.

Keep get-turn-credentials verify_jwt=false because the handler verifies the signed-in caller using auth.getUser. Keep send-push-notification verify_jwt=true, plus its internal caller verification. Do not disable authentication to make tests pass.

Push request contract: a call invitation uses {call_id}; recipients/content are derived from the verified active call and its members. Self-tests use {user_id: currentUserId}. Arbitrary recipients are intentionally rejected. The local frontend already uses this contract, but its other changes are not yet published; do not silently alter the hosted frontend for compatibility.

Confirm deployment success and report both function versions. Check anonymous TURN requests return 401 and signed-out push requests are rejected without sending notifications. Resolve bundling/runtime errors only within these two functions and report any deviation from the provided sources. Never report or log returned ICE passwords, API keys, private VAPID keys, or user bearer tokens. Real-device audio and push tests will be performed separately with selected consenting test users.

## supabase/functions/get-turn-credentials/index.ts

```typescript
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
```

## supabase/functions/send-push-notification/index.ts

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return reply({ error: 'Unauthorized' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) return reply({ error: 'Unauthorized' }, 401);
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) return reply({ error: 'Push is not configured' }, 503);
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const input = await req.json();
    let recipients: string[] = [];
    let title = 'StudyGram', body = '', tag = 'notification', data: Record<string, unknown> = {};
    let ttl = 300;
    if (input.call_id) {
      const { data: call, error } = await db.from('calls').select('id, conversation_id, started_by, started_at, is_active').eq('id', input.call_id).single();
      if (error || !call || !call.is_active || call.started_by !== user.id) return reply({ error: 'Call is unavailable or not yours' }, 403);
      if (Date.now() - new Date(call.started_at).getTime() > 120000) return reply({ error: 'Call invite has expired' }, 409);
      const [{ data: conversation }, { data: caller }, { data: members, error: membersError }] = await Promise.all([
        db.from('conversations').select('name, type').eq('id', call.conversation_id).single(),
        db.from('profiles').select('full_name, username').eq('user_id', user.id).single(),
        db.from('conversation_participants').select('user_id, role').eq('conversation_id', call.conversation_id)
      ]);
      if (membersError) throw membersError;
      const host = members?.find(member => member.user_id === user.id);
      if (!host || (conversation?.type !== 'direct' && !['owner', 'admin'].includes(host.role))) return reply({ error: 'Not authorized' }, 403);
      recipients = [...new Set((members || []).map(member => member.user_id))].filter(id => id !== user.id);
      const name = caller?.full_name || caller?.username || 'A member';
      title = conversation?.type === 'direct' ? name : conversation?.name || 'Study session';
      body = conversation?.type === 'direct' ? 'Incoming voice call' : name + ' started a live audio session';
      tag = 'call-' + call.id;
      data = { type: conversation?.type === 'direct' ? 'call' : 'live_call', callId: call.id, conversationId: call.conversation_id };
      ttl = 60;
    } else {
      // Explicit notification tests are self-only. Shared membership is not permission to send arbitrary pushes.
      if (input.user_id !== user.id) return reply({ error: 'Only self-tests or verified call invites are supported' }, 403);
      recipients = [user.id];
      title = 'StudyGram';
      body = 'Your notification test arrived.';
      data = { type: 'test' };
    }
    let sent = 0, failed = 0;
    for (let offset = 0; offset < recipients.length; offset += 100) {
      const { data: subscriptions, error } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', recipients.slice(offset, offset + 100));
      if (error) throw error;
      for (let at = 0; at < (subscriptions?.length || 0); at += 20) {
        await Promise.all(subscriptions!.slice(at, at + 20).map(async subscription => {
          try {
            // Do not allow user-written endpoints to turn this service into an arbitrary HTTP proxy.
            const endpoint = new URL(subscription.endpoint);
            const host = endpoint.hostname;
            if (endpoint.protocol !== 'https:' || !(
              host === 'fcm.googleapis.com' ||
              host === 'updates.push.services.mozilla.com' ||
              host === 'web.push.apple.com' ||
              host.endsWith('.notify.windows.com')
            )) throw new Error('Unsupported push provider');
            await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
              JSON.stringify({ title, body, tag, data, icon: '/pwa-192x192.png', badge: '/pwa-192x192.png' }),
              { vapidDetails: { subject: Deno.env.get('VAPID_SUBJECT') || 'https://studdybuddyapp.com', publicKey, privateKey }, TTL: ttl, urgency: 'high', timeout: 10000 });
            sent++;
          } catch (error) {
            failed++;
            const status = (error as { statusCode?: number }).statusCode;
            // Network/transient failures must not unsubscribe a working device.
            if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', subscription.id);
          }
        }));
      }
    }
    return reply({ success: failed === 0, sent, failed });
  } catch {
    return reply({ error: 'Notification delivery failed' }, 500);
  }
});
```

## Function configuration (do not overwrite unrelated entries)

```toml
[functions.get-turn-credentials]
verify_jwt = false

[functions.send-push-notification]
verify_jwt = true
```

