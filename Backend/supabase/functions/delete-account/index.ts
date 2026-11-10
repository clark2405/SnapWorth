// POST { "confirm": "DELETE" } — deletes the caller's account for good: their files in Storage,
// then their Auth user, which every table's foreign keys cascade from. The caller's session is
// checked with Supabase Auth here (the gateway's JWT check is off, as for estimate-price, so the
// newer publishable keys work); the deleting is done with the service role, which never leaves
// the server.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { createDeleteAccountHandler, type StoredEntry } from './account.ts';

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Supabase answers a missing bucket with a 404 in its body, whatever the HTTP status. */
function missingBucket(error: { message?: string; statusCode?: string; code?: string }): boolean {
  return error.code === 'NoSuchBucket' || error.statusCode === '404' ||
    /bucket not found/i.test(error.message ?? '');
}

Deno.serve(
  createDeleteAccountHandler({
    async authenticate(token) {
      const { data, error } = await admin.auth.getUser(token);
      if (error) {
        if (error.status && error.status >= 400 && error.status < 500) return null;
        throw error;
      }
      return data.user?.id ?? null;
    },
    files: {
      async list(bucket, folder, offset, limit) {
        const { data, error } = await admin.storage
          .from(bucket)
          .list(folder, { limit, offset, sortBy: { column: 'name', order: 'asc' } });
        if (error) {
          if (missingBucket(error as { message?: string; statusCode?: string; code?: string })) {
            return null;
          }
          throw error;
        }
        // Folders are listed with no id.
        return data.map((entry): StoredEntry => ({ name: entry.name, folder: entry.id === null }));
      },
      async remove(bucket, paths) {
        const { error } = await admin.storage.from(bucket).remove(paths);
        if (error) throw error;
      },
    },
    async deleteUser(userId) {
      // A hard delete: soft-deleting would keep the user, and so every row, in place.
      const { error } = await admin.auth.admin.deleteUser(userId, false);
      if (error && error.status !== 404) throw error;
    },
  }),
);
