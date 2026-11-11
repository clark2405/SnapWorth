// Screens pending public text and approves or holds it; see handler.ts for the request shape.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { providerFromEnv } from '../_shared/providers/moderation.ts';
import { handleModeration } from './handler.ts';
import type { ModerationDb } from './targets.ts';

Deno.serve((request: Request) =>
  handleModeration(request, {
    db: () =>
      createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } },
      ) as unknown as ModerationDb,
    provider: providerFromEnv((name) => Deno.env.get(name)),
  }),
);
