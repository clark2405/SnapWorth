// POST { "type": "comment" | "hanap", "id": "<uuid>" } — screens a pending comment or hanap post
// and approves or holds it. Called by the app right after one is posted; requires a signed-in caller (the
// function's JWT check) and runs the database update with the service role, which is the only
// way moderation fields can change.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { providerFromEnv } from '../_shared/providers/moderation.ts';
import { moderateComment, type CommentStore, type ModerationStatus } from './moderate.ts';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};
/** What can be screened, and the table each lives in. Both share the moderation columns. */
function tableFor(type: unknown): string | null {
  switch (type) {
    case 'comment':
      return 'comments';
    case 'hanap':
      return 'hanap_posts';
    default:
      return null;
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json(405, { error: 'Use POST.' });

  let target: { type?: unknown; id?: unknown };
  try {
    target = await request.json();
  } catch {
    return json(400, { error: 'Expected a JSON body.' });
  }
  const table = tableFor(target.type);
  if (!table || typeof target.id !== 'string' || !uuid.test(target.id)) {
    return json(400, { error: 'Expected { "type": "comment" | "hanap", "id": "<uuid>" }.' });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
  const store: CommentStore = {
    async get(id) {
      const { data, error } = await db
        .from(table)
        .select('body, moderation_status')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? { body: data.body, status: data.moderation_status as ModerationStatus } : null;
    },
    async settle(id, status, ref) {
      const { error } = await db
        .from(table)
        .update({ moderation_status: status, moderation_ref: ref, moderated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('moderation_status', 'pending');
      if (error) throw error;
    },
  };

  const outcome = await moderateComment(
    store,
    providerFromEnv((name) => Deno.env.get(name)),
    target.id,
    request.signal,
  );
  if (outcome.kind === 'not_found') return json(404, { error: 'Nothing to screen with that id.' });
  if (outcome.kind === 'retry_later') {
    return json(503, { status: 'pending', retryable: true });
  }
  return json(200, { status: outcome.status });
});
