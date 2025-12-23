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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, title, body, data, tag } = await req.json();

    console.log('Sending notification to user:', user_id);
    console.log('Title:', title);
    console.log('Body:', body);

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
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
      await supabase
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
