// Deleting an account for good. The handler is built from the pieces below so the tests can
// stand in for Supabase; index.ts wires them to the real project with the service role.

/** What the person types in the app to confirm, sent along so the server checks it too. */
export const confirmationWord = 'DELETE';

/**
 * The Storage buckets that keep files under each person's own folder: `avatars` holds
 * `<user id>/avatar.<jpg|png|webp>`, `scan-photos` holds `<user id>/<scan id>.jpg`. A bucket that
 * doesn't exist yet is skipped. Add any new bucket that holds someone's files here, or deleting
 * their account leaves the files behind.
 */
export const accountBuckets = ['avatars', 'scan-photos'] as const;

/** One entry in a Storage folder: a file, or a folder to look inside. */
export interface StoredEntry {
  readonly name: string;
  readonly folder: boolean;
}

/** The slice of Supabase Storage the deletion needs. */
export interface FileStore {
  /**
   * Up to `limit` entries directly inside `folder`, from `offset` on. Resolves null when the
   * bucket doesn't exist.
   */
  list(bucket: string, folder: string, offset: number, limit: number): Promise<StoredEntry[] | null>;
  /** Removes these files (at most `removeBatch` at a time). */
  remove(bucket: string, paths: string[]): Promise<void>;
}

export interface Dependencies {
  /** The signed-in user's id for a session token; null for a token Auth refuses. */
  authenticate(token: string): Promise<string | null>;
  files: FileStore;
  /**
   * Deletes the Auth user, which cascades through every table that refers to them. A user who
   * is already gone counts as deleted.
   */
  deleteUser(userId: string): Promise<void>;
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const listPage = 100;
export const removeBatch = 1000;

function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { ...cors, 'cache-control': 'no-store' } });
}
function error(status: number, code: string): Response {
  return json(status, { code });
}

/** Every file under `folder` in a bucket, however deep; null when the bucket doesn't exist. */
async function filesUnder(files: FileStore, bucket: string, folder: string): Promise<string[] | null> {
  const found: string[] = [];
  for (let offset = 0; ; offset += listPage) {
    const entries = await files.list(bucket, folder, offset, listPage);
    if (entries === null) return null;
    for (const entry of entries) {
      const path = `${folder}/${entry.name}`;
      if (entry.folder) found.push(...((await filesUnder(files, bucket, path)) ?? []));
      else found.push(path);
    }
    if (entries.length < listPage) return found;
  }
}

/** Removes everything in the person's folder of each bucket. Throws if any of it stays. */
export async function removeAccountFiles(files: FileStore, userId: string): Promise<number> {
  let removed = 0;
  for (const bucket of accountBuckets) {
    const paths = await filesUnder(files, bucket, userId);
    if (!paths) continue;
    for (let start = 0; start < paths.length; start += removeBatch) {
      const batch = paths.slice(start, start + removeBatch);
      await files.remove(bucket, batch);
      removed += batch.length;
    }
  }
  return removed;
}

/**
 * POST { "confirm": "DELETE" } with the person's session. Their files go first, so a failure
 * there leaves the account whole to try again; then the Auth user, and with it every row that
 * refers to them. Repeated calls are limited per account, as a stolen session's worst case.
 */
export function createDeleteAccountHandler(deps: Dependencies) {
  const recent = new Map<string, number[]>();
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return error(405, 'method_not_allowed');

    const token = /^Bearer (.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) return error(401, 'authentication_required');
    let userId: string | null;
    try {
      userId = await deps.authenticate(token);
    } catch {
      return error(503, 'authentication_unavailable');
    }
    if (!userId) return error(401, 'authentication_required');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const confirm = (body as { confirm?: unknown } | null)?.confirm;
    if (typeof confirm !== 'string' || confirm.trim() !== confirmationWord) {
      return error(400, 'confirmation_required');
    }

    const now = Date.now();
    for (const [id, times] of recent) {
      if (!times.some((time) => now - time < 600_000)) recent.delete(id);
    }
    const attempts = (recent.get(userId) ?? []).filter((time) => now - time < 600_000);
    if (attempts.length >= 5) return error(429, 'rate_limited');
    recent.set(userId, [...attempts, now]);

    try {
      await removeAccountFiles(deps.files, userId);
    } catch {
      return error(503, 'files_not_removed');
    }
    try {
      await deps.deleteUser(userId);
    } catch {
      return error(503, 'not_deleted');
    }
    recent.delete(userId);
    return json(200, { deleted: true });
  };
}
