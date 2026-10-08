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
