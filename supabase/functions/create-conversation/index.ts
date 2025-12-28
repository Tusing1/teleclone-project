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

    const { type, name, description, memberIds, enableDiscussion, participantId } = await req.json()
    console.log('Creating conversation:', { type, name, userId: user.id, enableDiscussion, participantId })

    // Handle participantId - create direct 1:1 conversation (for friend requests)
    if (participantId) {
      console.log('Creating direct conversation with participant:', participantId)
      
      // Check if a direct conversation already exists between these two users
      const { data: userConversations } = await supabaseAdmin
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      if (userConversations && userConversations.length > 0) {
        const conversationIds = userConversations.map(p => p.conversation_id)
        
        // Get all direct conversations
        const { data: directConversations } = await supabaseAdmin
          .from('conversations')
          .select('id')
          .in('id', conversationIds)
          .eq('type', 'direct')

        if (directConversations) {
          // Check each direct conversation to see if it includes the participant
          for (const conv of directConversations) {
            const { data: participants, count } = await supabaseAdmin
              .from('conversation_participants')
              .select('user_id', { count: 'exact' })
              .eq('conversation_id', conv.id)

            // Direct 1:1 conversation = exactly 2 participants
            if (count === 2 && participants) {
              const participantIds = participants.map(p => p.user_id)
              if (participantIds.includes(user.id) && participantIds.includes(participantId)) {
                console.log('Direct conversation already exists:', conv.id)
                return new Response(JSON.stringify({ id: conv.id }), {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
              }
            }
          }
        }
      }

      // Create new direct conversation
      const { data: newConv, error: convError } = await supabaseAdmin
        .from('conversations')
        .insert({ type: 'direct', created_by: user.id })
        .select()
        .single()

      if (convError) {
        console.error('Error creating direct conversation:', convError)
        return new Response(JSON.stringify({ error: convError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Add both participants
      const { error: partError } = await supabaseAdmin
        .from('conversation_participants')
        .insert([
          { conversation_id: newConv.id, user_id: user.id, role: 'member' },
          { conversation_id: newConv.id, user_id: participantId, role: 'member' }
        ])

      if (partError) {
        console.error('Error adding participants:', partError)
        await supabaseAdmin.from('conversations').delete().eq('id', newConv.id)
        return new Response(JSON.stringify({ error: 'Failed to add participants' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('Direct conversation created:', newConv.id)
      return new Response(JSON.stringify({ id: newConv.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let discussionId = null

    // For "saved" type or self-chat, create "Message Yourself" conversation
    if (type === 'saved' || (type === 'direct' && (!memberIds || memberIds.length === 0))) {
      // Check if self-chat already exists
      const { data: allUserConversations } = await supabaseAdmin
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      let existingSelfChatId: string | null = null
      const duplicateSelfChatIds: string[] = []

      if (allUserConversations && allUserConversations.length > 0) {
        const conversationIds = allUserConversations.map(p => p.conversation_id)
        
        // Get all direct conversations
        const { data: directConversations } = await supabaseAdmin
          .from('conversations')
          .select('id, created_at')
          .in('id', conversationIds)
          .eq('type', 'direct')
          .order('created_at', { ascending: true })

        if (directConversations) {
          for (const conv of directConversations) {
            const { data: participants, count } = await supabaseAdmin
              .from('conversation_participants')
              .select('*', { count: 'exact' })
              .eq('conversation_id', conv.id)

            // Self-chat = direct conversation with only the current user
            if (count === 1 && participants?.[0]?.user_id === user.id) {
              if (!existingSelfChatId) {
                existingSelfChatId = conv.id
              } else {
                // This is a duplicate - mark for cleanup
                duplicateSelfChatIds.push(conv.id)
              }
            }
          }
        }
      }

      // Clean up duplicates if any exist
      if (duplicateSelfChatIds.length > 0) {
        console.log('Cleaning up duplicate self-chats:', duplicateSelfChatIds)
        for (const dupId of duplicateSelfChatIds) {
          // Move messages to the main self-chat
          if (existingSelfChatId) {
            await supabaseAdmin
              .from('messages')
              .update({ conversation_id: existingSelfChatId })
              .eq('conversation_id', dupId)
          }
          // Delete participants and conversation
          await supabaseAdmin.from('conversation_participants').delete().eq('conversation_id', dupId)
          await supabaseAdmin.from('conversations').delete().eq('id', dupId)
        }
      }

      if (existingSelfChatId) {
        console.log('Self-chat already exists:', existingSelfChatId)
        return new Response(JSON.stringify({ id: existingSelfChatId }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Create new self-chat conversation
      const { data: selfChat, error: selfChatError } = await supabaseAdmin
        .from('conversations')
        .insert({ type: 'direct', name: null, created_by: user.id })
        .select()
        .single()

      if (selfChatError) {
        console.error('Self-chat creation error:', selfChatError)
        return new Response(JSON.stringify({ error: selfChatError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Add only the current user as participant
      const { error: partError } = await supabaseAdmin
        .from('conversation_participants')
        .insert({ conversation_id: selfChat.id, user_id: user.id, role: 'owner' })

      if (partError) {
        console.error('Error adding participant to self-chat:', partError)
        await supabaseAdmin.from('conversations').delete().eq('id', selfChat.id)
        return new Response(JSON.stringify({ error: 'Failed to create self-chat' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('Self-chat created:', selfChat.id)
      return new Response(JSON.stringify({ id: selfChat.id }), {
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
