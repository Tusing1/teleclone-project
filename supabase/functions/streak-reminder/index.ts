import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];
    
    // Find users with active streaks who haven't logged in today
    const { data: usersAtRisk, error } = await supabase
      .from('login_streaks')
      .select(`
        user_id,
        current_streak,
        last_login_date
      `)
      .gt('current_streak', 0)
      .neq('last_login_date', today);

    if (error) {
      console.error("Error fetching users at risk:", error);
      throw error;
    }

    console.log(`Found ${usersAtRisk?.length || 0} users with streaks at risk`);

    // Get push subscriptions for these users
    const userIds = usersAtRisk?.map(u => u.user_id) || [];
    
    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users need reminders" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }

    console.log(`Found ${subscriptions?.length || 0} push subscriptions`);

    // Send push notifications
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");

    if (!vapidPrivateKey || !vapidPublicKey) {
      console.error("VAPID keys not configured");
      return new Response(
        JSON.stringify({ error: "Push notifications not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;
    for (const sub of subscriptions || []) {
      const userStreak = usersAtRisk?.find(u => u.user_id === sub.user_id);
      if (!userStreak) continue;

      try {
        // Call the existing send-push-notification function
        const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            subscription: {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
              }
            },
            payload: {
              title: "🔥 Don't lose your streak!",
              body: `Log in now to keep your ${userStreak.current_streak} day streak going!`,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: 'streak-reminder',
              data: { type: 'streak-reminder' }
            }
          }
        });

        if (pushError) {
          console.error(`Failed to send notification to user ${sub.user_id}:`, pushError);
        } else {
          sentCount++;
        }
      } catch (e) {
        console.error(`Error sending push to user ${sub.user_id}:`, e);
      }
    }

    console.log(`Successfully sent ${sentCount} streak reminders`);

    return new Response(
      JSON.stringify({ 
        message: `Sent ${sentCount} streak reminders`,
        usersAtRisk: usersAtRisk?.length || 0,
        subscriptionsFound: subscriptions?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Streak reminder error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
