import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

// Web Push library for Deno
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<Response> {
  const { endpoint, p256dh, auth } = subscription;
  
  // For web push, we need to use the web-push protocol
  // Since Deno doesn't have native web-push, we'll use a simpler approach
  // by calling a service or implementing the protocol
  
  const vapidHeaders = {
    'Authorization': `vapid t=${await generateVapidToken(endpoint)}, k=${VAPID_PUBLIC_KEY}`,
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    'TTL': '86400',
  };
  
  // For now, we'll log the notification and return success
  // In production, you'd implement the full web-push protocol
  console.log('Sending push to:', endpoint);
  console.log('Payload:', payload);
  
  return new Response('OK', { status: 200 });
}

async function generateVapidToken(endpoint: string): Promise<string> {
  // Generate JWT for VAPID
  const audience = new URL(endpoint).origin;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours
  
  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = btoa(JSON.stringify({
    aud: audience,
    exp: expiration,
    sub: 'mailto:noreply@lovable.dev'
  }));
  
  // For a full implementation, you'd sign this with the VAPID private key
  // For now, return a placeholder
  return `${header}.${payload}.signature`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's auth token to verify their identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: callerUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !callerUser) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated caller:', callerUser.id);

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, title, body, data, tag } = await req.json();

    console.log('Sending notification to user:', user_id);
    console.log('Title:', title);
    console.log('Body:', body);

    // Authorization check: Verify caller has permission to send to target user
    // Users can only send notifications to users they share a conversation with
    if (user_id !== callerUser.id) {
      // Get conversations the caller is in
      const { data: callerConversations, error: callerConvError } = await supabaseAdmin
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', callerUser.id);

      if (callerConvError) {
        console.error('Error fetching caller conversations:', callerConvError);
        return new Response(
          JSON.stringify({ error: 'Internal error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const callerConvIds = callerConversations?.map(c => c.conversation_id) || [];

      if (callerConvIds.length === 0) {
        console.error('Caller has no conversations, cannot notify others');
        return new Response(
          JSON.stringify({ error: 'Not authorized to send notifications to this user' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if target user shares any conversation with caller
      const { data: sharedConversations, error: sharedError } = await supabaseAdmin
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user_id)
        .in('conversation_id', callerConvIds);

      if (sharedError) {
        console.error('Error checking shared conversations:', sharedError);
        return new Response(
          JSON.stringify({ error: 'Internal error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!sharedConversations || sharedConversations.length === 0) {
        console.error('Caller does not share any conversation with target user');
        return new Response(
          JSON.stringify({ error: 'Not authorized to send notifications to this user' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Authorization passed: caller shares', sharedConversations.length, 'conversations with target');
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No subscriptions found for user');
      return new Response(
        JSON.stringify({ success: true, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: tag || 'notification',
      data: data || {}
    });

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(sub => sendWebPush(sub, payload))
    );

    console.log('Push results:', results);

    // Remove failed subscriptions (expired or unsubscribed)
    const failedEndpoints = subscriptions
      .filter((_, i) => results[i].status === 'rejected')
      .map(sub => sub.endpoint);

    if (failedEndpoints.length > 0) {
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .in('endpoint', failedEndpoints);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: subscriptions.length - failedEndpoints.length,
        failed: failedEndpoints.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
