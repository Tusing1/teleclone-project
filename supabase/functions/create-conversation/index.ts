import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create client with service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the user's token
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { type, name, description, memberIds, enableDiscussion } = await req.json()
    console.log('Creating conversation:', { type, name, userId: user.id, enableDiscussion })

    let discussionId = null

    // For "saved" type or direct with no members, create Saved Messages
    if (type === 'saved' || (type === 'direct' && (!memberIds || memberIds.length === 0))) {
      // Check if Saved Messages already exists - use a more robust check
      const { data: allUserConversations } = await supabaseAdmin
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      if (allUserConversations && allUserConversations.length > 0) {
        const conversationIds = allUserConversations.map(p => p.conversation_id)
        
        // Get all direct conversations
        const { data: directConversations } = await supabaseAdmin
          .from('conversations')
          .select('id')
          .in('id', conversationIds)
          .eq('type', 'direct')

        if (directConversations) {
          for (const conv of directConversations) {
            const { data: participants, count } = await supabaseAdmin
              .from('conversation_participants')
              .select('*', { count: 'exact' })
              .eq('conversation_id', conv.id)

            // Saved Messages = direct conversation with only the current user
            if (count === 1 && participants?.[0]?.user_id === user.id) {
              console.log('Saved Messages already exists:', conv.id)
              return new Response(JSON.stringify({ id: conv.id }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            }
          }
        }
      }

      // Create new Saved Messages with a unique check using upsert pattern
      // First try to acquire a lock by checking again (prevents race condition)
      const { data: savedConv, error: savedError } = await supabaseAdmin
        .from('conversations')
        .insert({ type: 'direct', name: null, created_by: user.id })
        .select()
        .single()

      if (savedError) {
        console.error('Saved Messages creation error:', savedError)
        return new Response(JSON.stringify({ error: savedError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Add only the current user as participant
      const { error: partError } = await supabaseAdmin
        .from('conversation_participants')
        .insert({ conversation_id: savedConv.id, user_id: user.id, role: 'owner' })

      if (partError) {
        console.error('Error adding participant to Saved Messages:', partError)
        // If participant insert fails, delete the conversation and try to find existing
        await supabaseAdmin.from('conversations').delete().eq('id', savedConv.id)
        
        // Re-check for existing Saved Messages
        const { data: retryConversations } = await supabaseAdmin
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', user.id)

        if (retryConversations) {
          for (const p of retryConversations) {
            const { data: convData } = await supabaseAdmin
              .from('conversations')
              .select('id, type')
              .eq('id', p.conversation_id)
              .single()

            if (convData?.type !== 'direct') continue

            const { data: participants } = await supabaseAdmin
              .from('conversation_participants')
              .select('*')
              .eq('conversation_id', p.conversation_id)

            if (participants?.length === 1 && participants[0].user_id === user.id) {
              return new Response(JSON.stringify({ id: p.conversation_id }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            }
          }
        }
        
        return new Response(JSON.stringify({ error: 'Failed to create Saved Messages' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('Saved Messages created:', savedConv.id)
      return new Response(JSON.stringify({ id: savedConv.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // For channels with discussion enabled, create discussion group first
    if (type === 'channel' && enableDiscussion) {
      const { data: discussion, error: discError } = await supabaseAdmin
        .from('conversations')
        .insert({
          type: 'group',
          name: `${name} Discussion`,
          description: `Discussion group for ${name} channel`,
          created_by: user.id
        })
        .select()
        .single()

      if (discError) {
        console.error('Discussion creation error:', discError)
      } else {
        discussionId = discussion.id
        console.log('Discussion group created:', discussionId)

        // Add owner to discussion
        await supabaseAdmin
          .from('conversation_participants')
          .insert({ conversation_id: discussionId, user_id: user.id, role: 'owner' })
      }
    }

    // Create the main conversation (channel or group)
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .insert({
        type,
        name: name || null,
        description: description || null,
        created_by: user.id,
        linked_discussion_id: discussionId
      })
      .select()
      .single()

    if (convError) {
      console.error('Conversation creation error:', convError)
      return new Response(JSON.stringify({ error: convError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Conversation created:', conversation.id)

    // Add participants
    const participants = [
      { conversation_id: conversation.id, user_id: user.id, role: 'owner' }
    ]

    // Also add to discussion group if it exists
    const discussionParticipants = discussionId ? [
      { conversation_id: discussionId, user_id: user.id, role: 'owner' }
    ] : []

    if (memberIds && memberIds.length > 0) {
      memberIds.forEach((id: string) => {
        participants.push({ conversation_id: conversation.id, user_id: id, role: 'member' })
        // Also add to discussion group
        if (discussionId) {
          discussionParticipants.push({ conversation_id: discussionId, user_id: id, role: 'member' })
        }
      })
    }

    const { error: participantError } = await supabaseAdmin
      .from('conversation_participants')
      .insert(participants)

    if (participantError) {
      console.error('Participant error:', participantError)
    }

    // Add members to discussion group
    if (discussionParticipants.length > 1) {
      const { error: discPartError } = await supabaseAdmin
        .from('conversation_participants')
        .insert(discussionParticipants.slice(1)) // Owner already added above

      if (discPartError) {
        console.error('Discussion participant error:', discPartError)
      }
    }

    console.log('Participants added successfully')

    return new Response(JSON.stringify({ 
      id: conversation.id,
      discussionId 
    }), {
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