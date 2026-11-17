import type { SupabaseClient } from '@supabase/supabase-js';

import type { WorthyCloud, WorthyCloudReply } from '../../ports/worthy';
import { err, ok } from '../../types/result';

const intents = ['chat', 'price', 'trend', 'collection', 'listing'] as const;

function validReply(value: unknown): WorthyCloudReply | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (!intents.includes(row.intent as (typeof intents)[number])) return null;
  if (typeof row.reply !== 'string' || !row.reply.trim()) return null;
  const draft = row.draft as { title?: unknown; description?: unknown } | null | undefined;
  return {
    intent: row.intent as WorthyCloudReply['intent'],
    reply: row.reply.trim(),
    draft:
      draft && typeof draft.title === 'string' && typeof draft.description === 'string'
        ? { title: draft.title, description: draft.description }
        : null,
  };
}

/**
 * Worthy's chat through the `worthy-chat` Edge Function. Only for a signed-in account: it never
 * signs a device in to ask. Anything that goes wrong is an error for the chat to fall back from.
 */
export function createSupabaseWorthyCloud(client: SupabaseClient): WorthyCloud {
  return {
    async ask(question, history, context, signal) {
      const { data: session } = await client.auth.getSession();
      if (!session.session || session.session.user?.is_anonymous) {
        return err({ kind: 'authorization', code: 'not_found_or_denied' });
      }
      const { data, error } = await client.functions.invoke<unknown>('worthy-chat', {
        body: { question, history, context },
        signal,
      });
      if (error) return err({ kind: 'provider', code: 'worthy_unavailable', retryable: true });
      const reply = validReply(data);
      return reply
        ? ok(reply)
        : err({ kind: 'provider', code: 'worthy_unavailable', retryable: true });
    },
  };
}
