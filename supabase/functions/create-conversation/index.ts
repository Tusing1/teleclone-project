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

    const { type, name, description, memberIds } = await req.json()
    console.log('Creating conversation:', { type, name, userId: user.id })

    // Create the conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .insert({
        type,
        name: name || null,
        description: description || null,
        created_by: user.id
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

    if (memberIds && memberIds.length > 0) {
      memberIds.forEach((id: string) => {
        participants.push({ conversation_id: conversation.id, user_id: id, role: 'member' })
      })
    }

    const { error: participantError } = await supabaseAdmin
      .from('conversation_participants')
      .insert(participants)

    if (participantError) {
      console.error('Participant error:', participantError)
    }

    console.log('Participants added successfully')

    return new Response(JSON.stringify({ id: conversation.id }), {
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