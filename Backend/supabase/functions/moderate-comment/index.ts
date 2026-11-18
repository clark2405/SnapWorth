// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeCommentText(text: string): string {
  let cleaned = text.replace(/[\u200B-\u200D\uFEFF]/g, '')
  // Collapse single spaced letters e.g. "f u c k" -> "fuck", "g a g o" -> "gago"
  cleaned = cleaned.replace(/\b([a-zA-Z])\s+(?=[a-zA-Z]\b)/g, '$1')
  // Leetspeak substitutions
  cleaned = cleaned
    .replace(/[@]/g, 'a')
    .replace(/[\$]/g, 's')
    .replace(/[!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[1]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4]/g, 'a')
    .replace(/[5]/g, 's')
  return cleaned
}

const MODERATION_PATTERNS: readonly { readonly reason: string; readonly pattern: RegExp }[] = [
  // 1. Hate speech, discrimination & slurs
  { reason: 'hate speech / slur', pattern: /\bn+[i1!|*]+g+g+[e3a4*]+r*s*\b/i },
  { reason: 'hate speech / slur', pattern: /\bn+[i1!|*]+g+g+[a4*]+s*\b/i },
  { reason: 'hate speech / slur', pattern: /\bf+[a4*]+g+([o0*]+t+s*|s*)\b/i },
  { reason: 'hate speech / slur', pattern: /\br+[e3*]+t+[a4*]+r+d+(s*|ed*|ing*)\b/i },
  { reason: 'hate speech / slur', pattern: /\bk+[i1!*]+k+[e3*]+s*\b/i },
  { reason: 'hate speech / slur', pattern: /\bc+h+[i1!*]+n+k+s*\b/i },
  { reason: 'hate speech / slur', pattern: /\bs+p+[i1!*]+c+s*\b/i },
  { reason: 'hate speech / slur', pattern: /\bt+r+[a4*]+n+n+y*\b/i },
  { reason: 'hate speech / slur', pattern: /\bg+[o0\*]+o+k+s*\b/i },
  { reason: 'hate speech / slur', pattern: /\bw+e+t+b+[a4\*]+c+k+s*\b/i },

  // 2. Swear words & profanity (English)
  { reason: 'profanity', pattern: /\bf+[\*u_a]+c+k+(s*|ing*|er*|ed*)\b/i },
  { reason: 'profanity', pattern: /\bm+o+t+h+e+r+f+[\*u_a]+c+k+(e*r*s*|ing*)\b/i },
  { reason: 'profanity', pattern: /\bs+h+[\*i!1_]+t+(s*|ty*|ted*|ting*|head*)\b/i },
  { reason: 'profanity', pattern: /\bb+[\*i!1_]+t+c+h+(es*|ing*|y*)\b/i },
  { reason: 'profanity', pattern: /\ba+s+s+h+o+l+e+s*\b/i },
  { reason: 'profanity', pattern: /\b(dumb|fat|lazy|piece\s+of)\s+ass\b/i },
  { reason: 'profanity', pattern: /\bc+[\*u_]+n+t+s*\b/i },
  { reason: 'profanity', pattern: /\bb+a+s+t+a+r+d+s*\b/i },
  { reason: 'profanity', pattern: /\bw+h+[o0\*]+r+[e3\*]+s*\b/i },
  { reason: 'profanity', pattern: /\bs+l+[\*u]+t+s*\b/i },
  { reason: 'profanity', pattern: /\bd+[\*i!]+c+k+(s*|head*)\b/i },
  { reason: 'profanity', pattern: /\bp+[\*u]+s+s+y+(s*|ies*)\b/i },
  { reason: 'profanity', pattern: /\bt+w+[a4\*]+t+s*\b/i },
  { reason: 'profanity', pattern: /\bw+[a4\*]+n+k+[e3\*]+r*s*\b/i },
  { reason: 'profanity', pattern: /\bp+r+[i1\*]+c+k+s*\b/i },

  // 3. Profanity, slurs & insults (Filipino / Tagalog)
  { reason: 'profanity (Filipino)', pattern: /\bp+[\*u]+t+a+([nñ]+g*[\s\-_]*[i1]+n+a+)?\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bt+[\*a]+[nñ]+g*[\s\-_]*[i1]+n+a+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bt+a+e+n+a+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bg+[a4\*]+g+[o0a4\*]+s*\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bt+[a4\*]+r+[a4\*]+n+t+[a4\*]+d+[o0a4\*]+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bu+l+[o0\*]+l+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bb+[o0\*]+b+[o0\*]+s*\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bp+[a4\*]+k+y+[o0\*u]+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bk+[\*u]+p+[a4\*]+l+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bi+n+[u\*]+t+[i1\*]+l+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bl+e+t*c+h+e+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bp+e+s+t+e+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bp+[o0\*]+k+p+[o0\*]+k+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bb+[a4\*]+y+[o0\*]+t+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bh+[i1\*]+n+d+[o0\*]+t+\b/i },
  { reason: 'profanity (Filipino)', pattern: /\bt+[a4\*]+n+g+[a4\*]+\b/i },

  // 4. Threats & severe harassment
  { reason: 'threat / self-harm', pattern: /\bk+i+l+l+\s+(your\s*self|ur\s*self)\b/i },
  { reason: 'threat / self-harm', pattern: /\bk+y+s+\b/i },
  { reason: 'harassment', pattern: /\bd+i+e+\s+(in\s+a\s+fire|bitch|trash|whore|scum)\b/i },
  { reason: 'harassment', pattern: /\b(slit|hang|shoot)\s+(your\s*self|ur\s*self)\b/i },
]

function checkForbiddenLanguage(text: string): { readonly flagged: boolean; readonly reason?: string } {
  const cleaned = normalizeCommentText(text)
  for (const item of MODERATION_PATTERNS) {
    if (item.pattern.test(cleaned) || item.pattern.test(text)) {
      return { flagged: true, reason: item.reason }
    }
  }
  return { flagged: false }
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
