import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// This function syncs channel members to their linked discussion groups
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { channelId, userId, action } = await req.json()
    console.log('Sync discussion members:', { channelId, userId, action })

    // Get the channel's linked discussion ID
    const { data: channel, error: channelError } = await supabaseAdmin
      .from('conversations')
      .select('linked_discussion_id')
      .eq('id', channelId)
      .eq('type', 'channel')
      .single()

    if (channelError || !channel?.linked_discussion_id) {
      console.log('No linked discussion found for channel')
      return new Response(JSON.stringify({ success: true, message: 'No linked discussion' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const discussionId = channel.linked_discussion_id

    if (action === 'add') {
      // Check if user is already a member of the discussion
      const { data: existing } = await supabaseAdmin
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', discussionId)
        .eq('user_id', userId)
        .maybeSingle()

      if (!existing) {
        // Add user to discussion group as member
        const { error: addError } = await supabaseAdmin
          .from('conversation_participants')
          .insert({
            conversation_id: discussionId,
            user_id: userId,
            role: 'member'
          })

        if (addError) {
          console.error('Error adding user to discussion:', addError)
        } else {
          console.log('User added to discussion group')
        }
      }
    } else if (action === 'remove') {
      // Get user's role in channel first
      const { data: channelRole } = await supabaseAdmin
        .from('conversation_participants')
        .select('role')
        .eq('conversation_id', channelId)
        .eq('user_id', userId)
        .maybeSingle()

      // Only remove if they're not owner/admin in channel
      if (channelRole?.role !== 'owner' && channelRole?.role !== 'admin') {
        const { error: removeError } = await supabaseAdmin
          .from('conversation_participants')
          .delete()
          .eq('conversation_id', discussionId)
          .eq('user_id', userId)

        if (removeError) {
          console.error('Error removing user from discussion:', removeError)
        } else {
          console.log('User removed from discussion group')
        }
      }
    } else if (action === 'sync_all') {
      // Sync all channel members to discussion
      const { data: channelMembers } = await supabaseAdmin
        .from('conversation_participants')
        .select('user_id, role')
        .eq('conversation_id', channelId)

      if (channelMembers) {
        for (const member of channelMembers) {
          const { data: existing } = await supabaseAdmin
            .from('conversation_participants')
            .select('id')
            .eq('conversation_id', discussionId)
            .eq('user_id', member.user_id)
            .maybeSingle()

          if (!existing) {
            await supabaseAdmin
              .from('conversation_participants')
              .insert({
                conversation_id: discussionId,
                user_id: member.user_id,
                role: member.role === 'owner' ? 'owner' : member.role === 'admin' ? 'admin' : 'member'
              })
          }
        }
        console.log('All channel members synced to discussion')
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
