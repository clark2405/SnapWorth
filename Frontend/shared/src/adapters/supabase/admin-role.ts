import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Whether the signed-in person is an admin, as the database says (`public.is_admin()`, which
 * reads a table only the database owner can write). It is a question, never a decision: the
 * answer decides what the profile offers, while the review functions check the role again on
 * every call. Anything but a clear yes (signed out, offline, an error) is no.
 */
export async function fetchIsAdmin(client: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await client.rpc('is_admin');
    return !error && data === true;
  } catch {
    return false;
  }
}
