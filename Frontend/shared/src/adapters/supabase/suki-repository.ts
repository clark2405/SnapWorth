import type { SupabaseClient } from '@supabase/supabase-js';

import type { SukiRepository } from '../../ports/suki';
import { err, ok } from '../../types/result';
import { toAppError } from './errors';
import { ensureSignedIn } from './session';

/**
 * Suki discounts stored in Supabase (`suki_discounts`). Row-level security decides who may see
 * or set one: only the seller sets it, for a buyer they've chatted with, and only the two of
 * them see it.
 */
export function createSupabaseSukiRepository(client: SupabaseClient): SukiRepository {
  return {
    async discountWith(otherUserId, iAmSeller) {
      const viewer = await ensureSignedIn(client);
      if (!viewer.ok) return err(viewer.error);
      const seller = iAmSeller ? viewer.value : otherUserId;
      const buyer = iAmSeller ? otherUserId : viewer.value;
      const { data, error } = await client
        .from('suki_discounts')
        .select('discount_pct')
        .eq('seller_id', seller)
        .eq('buyer_id', buyer)
        .maybeSingle();
      if (error) return err(toAppError(error, 'load_messages', 'suki'));
      return ok((data as { discount_pct: number } | null)?.discount_pct ?? null);
    },

    async set(buyerId, discountPct) {
      const viewer = await ensureSignedIn(client);
      if (!viewer.ok) return err(viewer.error);
      const result =
        discountPct === null
          ? await client
              .from('suki_discounts')
              .delete()
              .eq('seller_id', viewer.value)
              .eq('buyer_id', buyerId)
          : await client
              .from('suki_discounts')
              .upsert(
                { buyer_id: buyerId, discount_pct: discountPct },
                { onConflict: 'seller_id,buyer_id' },
              );
      if (result.error) return err(toAppError(result.error, 'send_message', 'suki'));
      return ok(undefined);
    },
  };
}
