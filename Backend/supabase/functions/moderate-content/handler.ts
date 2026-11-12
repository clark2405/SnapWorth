import type { ModerationProvider } from '../_shared/providers/moderation.ts';
import { moderateComment } from './moderate.ts';
import { storeFor, targetFor, type ModerationDb } from './targets.ts';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

/**
 * POST { "type": "comment" | "hanap" | "listing" | "post", "id": "<uuid>" } — screens a pending
 * comment, hanap post, listing or feed post and approves or holds it. Called by the app right
 * after one is posted or a listing's words are edited; the function's JWT check requires a
 * signed-in caller, and `db` is the service-role client, the only thing that can change
 * moderation fields.
 */
export async function handleModeration(
  request: Request,
  deps: { readonly db: () => ModerationDb; readonly provider: ModerationProvider | null },
): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json(405, { error: 'Use POST.' });

  let body: { type?: unknown; id?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Expected a JSON body.' });
  }
  const target = targetFor(body.type);
  if (!target || typeof body.id !== 'string' || !uuid.test(body.id)) {
    return json(400, {
      error: 'Expected { "type": "comment" | "hanap" | "listing" | "post", "id": "<uuid>" }.',
    });
  }

  const outcome = await moderateComment(
    storeFor(deps.db(), target),
    deps.provider,
    body.id,
    request.signal,
  );
  if (outcome.kind === 'not_found') return json(404, { error: 'Nothing to screen with that id.' });
  if (outcome.kind === 'retry_later') {
    return json(503, { status: 'pending', retryable: true });
  }
  return json(200, { status: outcome.status });
}
