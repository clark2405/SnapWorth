// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { checkForbiddenLanguage } from '../_shared/word-list.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests for React Native
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Get the comment data from the app
    const payload = await req.json()
    const text = (payload.text ?? payload.body ?? '').trim()
    const postId = payload.postId ?? payload.post_id
    const parentId = payload.parentId ?? payload.parent_id ?? payload.replyTo ?? null

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Comment text is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!postId) {
      return new Response(
        JSON.stringify({ error: 'Post ID is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Check built-in hate speech, profanity, and slur detection
    const ruleMatch = checkForbiddenLanguage(text)
    if (ruleMatch.flagged) {
      return new Response(
        JSON.stringify({
          error: 'This comment violates community guidelines (prohibited language, hate speech, or slurs) and was blocked.',
          blocked: true,
          reason: ruleMatch.reason,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Check OpenAI's Moderation API for semantic hate speech and harassment
    const openAiKey = Deno.env.get('OPENAI_KEY') ?? Deno.env.get('OPENAI_API_KEY')
    if (openAiKey) {
      try {
        const modResponse = await fetch('https://api.openai.com/v1/moderations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'omni-moderation-latest',
            input: text,
          }),
        })

        if (modResponse.ok) {
          const modData = await modResponse.json()
          const result = modData?.results?.[0]
          if (result) {
            let isAiFlagged = Boolean(result.flagged)
            if (!isAiFlagged && result.category_scores) {
              const scores = result.category_scores
              if ((scores.hate ?? 0) > 0.4 || (scores['hate/threatening'] ?? 0) > 0.3 || (scores.harassment ?? 0) > 0.4) {
                isAiFlagged = true
              }
            }

            if (isAiFlagged) {
              return new Response(
                JSON.stringify({
                  error: 'This comment violates community guidelines and was blocked.',
                  blocked: true,
                  reason: 'AI moderation flagged inappropriate content',
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
          }
        } else {
          console.error('OpenAI moderation status error:', modResponse.status)
        }
      } catch (modErr) {
        console.error('OpenAI moderation fetch error:', modErr)
        // Continue if external moderation API is temporarily unavailable
      }
    }

    // 4. Verify user authentication header
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Initialize Supabase using the user's Auth token to respect RLS policies and rate limits
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Schema permissions: authenticated role is only permitted to insert (body, post_id, parent_id).
    // moderation_status cannot be set on insert (it defaults to 'pending').
    const insertPayload: Record<string, unknown> = {
      body: text,
      post_id: postId,
    }
    if (parentId) {
      insertPayload.parent_id = parentId
    }

    const { data, error } = await supabaseClient
      .from('comments')
      .insert(insertPayload)
      .select('id, parent_id, body, moderation_status, created_at, author_id, author:profiles!comments_author_id_fkey(handle, display_name, avatar_url)')
      .single()

    if (error) {
      console.error('Comment insert error:', error.message)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Since the comment passed moderation, approve it using the service role key
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (serviceRoleKey && data?.id) {
      const adminClient = createClient(
        supabaseUrl,
        serviceRoleKey,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )
      const { error: updateError } = await adminClient
        .from('comments')
        .update({
          moderation_status: 'approved',
          moderated_at: new Date().toISOString(),
          moderation_ref: 'moderated',
        })
        .eq('id', data.id)

      if (updateError) {
        console.error('Comment approval error:', updateError.message)
      } else {
        data.moderation_status = 'approved'
      }
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const message = (error as Error)?.message ?? String(error)
    console.error("CRASH REASON:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
