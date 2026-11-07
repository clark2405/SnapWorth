import type { SupabaseClient } from '@supabase/supabase-js';

import type { PreviewHistoryItem, PreviewItemStatus } from '../preview/sample-data';

export const SCAN_HISTORY_STORAGE_KEY = '@snapworth/scan_history';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
}

export interface SavedScan {
  /** A UUID, made on the phone, so the scan keeps it on the phone and in Supabase. */
  readonly id: string;
  readonly title: string;
  readonly estimate: number;
  readonly lowPhp: number;
  readonly highPhp: number;
  readonly explanation: string;
  readonly assumptions: readonly string[];
  /** Where the photo is on the phone that took it; it only shows there (until Storage). */
  readonly photoUri: string;
  readonly capturedOn: string;
  readonly status: PreviewItemStatus;
  /** False until Supabase has it, so a scan saved offline is sent again later. */
  readonly synced?: boolean;
}

/** A scan as the camera makes it: the rest is filled in on saving. */
export type NewScan = Omit<SavedScan, 'id' | 'capturedOn' | 'status' | 'synced'>;

/**
 * How saving went: `saved` where it belongs (Supabase, or the phone without a backend),
 * `pending` kept on the phone until Supabase can be reached, `failed` not saved at all.
 */
export type SaveOutcome = 'saved' | 'pending' | 'failed';

/**
 * Where an account's scans live: the phone's copy, kept apart per account so someone signing in
 * on the same phone never sees the last person's, and Supabase when there's a backend.
 */
export interface ScanPlace {
  readonly store: KeyValueStore;
  readonly client: SupabaseClient | null;
  /** The signed-in account's id, or `device` when there's no backend to sign in to. */
  readonly owner: string;
}

const storageKey = (owner: string) => `${SCAN_HISTORY_STORAGE_KEY}:${owner}`;

/** A random version-4 UUID: the id type Supabase's `scan_history` table takes. */
export function newScanId(random: () => number = Math.random): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (slot) => {
    const nibble = Math.floor(random() * 16);
    return (slot === 'x' ? nibble : (nibble & 0x3) | 0x8).toString(16);
  });
}

export function formatCapturedDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function scanToPreviewItem(scan: SavedScan): PreviewHistoryItem {
  return {
    id: scan.id,
    title: scan.title,
    estimate: scan.estimate,
    status: scan.status,
    capturedOn: scan.capturedOn,
    photo: { uri: scan.photoUri },
    photoLabel: scan.title,
  };
}

async function readLocal(place: ScanPlace): Promise<SavedScan[]> {
  try {
    const raw = await place.store.getItem(storageKey(place.owner));
    return raw ? (JSON.parse(raw) as SavedScan[]) : [];
  } catch {
    return [];
  }
}

async function writeLocal(place: ScanPlace, scans: readonly SavedScan[]): Promise<boolean> {
  try {
    await place.store.setItem(storageKey(place.owner), JSON.stringify(scans));
    return true;
  } catch {
    return false;
  }
}

/** Sends a scan to Supabase; the owner is whoever is signed in, never chosen here. */
async function insertRemote(client: SupabaseClient, scan: SavedScan): Promise<boolean> {
  try {
    const { error } = await client.from('scan_history').insert({
      id: scan.id,
      item_name: scan.title,
      amount_php: scan.estimate,
      low_php: scan.lowPhp,
      high_php: Math.max(scan.lowPhp, scan.highPhp),
      explanation: scan.explanation,
      assumptions: scan.assumptions,
      photo_uri: scan.photoUri,
      status: scan.status,
    });
    return !error;
  } catch {
    return false;
  }
}

/** Saves a scan on the phone, then in Supabase when there's a backend. */
export async function saveScan(scan: SavedScan, place: ScanPlace): Promise<SaveOutcome> {
  const existing = await readLocal(place);
  const savedHere = await writeLocal(place, [
    { ...scan, synced: false },
    ...existing.filter((item) => item.id !== scan.id),
  ]);
  if (!place.client) return savedHere ? 'saved' : 'failed';

  if (!(await insertRemote(place.client, scan))) return savedHere ? 'pending' : 'failed';
  const after = await readLocal(place);
  await writeLocal(
    place,
    after.map((item) => (item.id === scan.id ? { ...item, synced: true } : item)),
  );
  return 'saved';
}

interface ScanRow {
  readonly id: string;
  readonly item_name: string;
  readonly amount_php: number;
  readonly low_php: number;
  readonly high_php: number;
  readonly explanation: string | null;
  readonly assumptions: unknown;
  readonly photo_uri: string | null;
  readonly status: string | null;
  readonly created_at: string;
}

const scanFromRow = (row: ScanRow): SavedScan => ({
  id: row.id,
  title: row.item_name,
  estimate: row.amount_php,
  lowPhp: row.low_php,
  highPhp: row.high_php,
  explanation: row.explanation ?? '',
  assumptions: Array.isArray(row.assumptions) ? (row.assumptions as string[]) : [],
  photoUri: row.photo_uri ?? '',
  capturedOn: formatCapturedDate(new Date(row.created_at)),
  status: (row.status as PreviewItemStatus) || 'private',
  synced: true,
});

/**
 * An account's scans, newest first. With a backend, Supabase's copy wins: scans saved offline
 * are sent again, and ones deleted on another device leave this one too. Without a reachable
 * backend, the phone's copy is shown.
 */
export async function loadScans(place: ScanPlace): Promise<SavedScan[]> {
  const local = await readLocal(place);
  if (!place.client) return local;

  const { data, error } = await place.client
    .from('scan_history')
    .select('*')
    .eq('user_id', place.owner)
    .order('created_at', { ascending: false })
    .then(
      (result) => result,
      () => ({ data: null, error: true }),
    );
  if (error || !Array.isArray(data)) return local;

  const remote = (data as ScanRow[]).map(scanFromRow);
  const remoteIds = new Set(remote.map((scan) => scan.id));
  // Saved here but never sent: send them now, and keep any that still can't go.
  const unsent: SavedScan[] = [];
  for (const scan of local.filter((item) => !item.synced && !remoteIds.has(item.id))) {
    if (await insertRemote(place.client, scan)) unsent.push({ ...scan, synced: true });
    else unsent.push(scan);
  }
  const combined = [...unsent, ...remote];
  await writeLocal(place, combined);
  return combined;
}

/** Deletes a scan from the phone and from Supabase. Resolves false if Supabase kept it. */
export async function deleteScan(scanId: string, place: ScanPlace): Promise<boolean> {
  const existing = await readLocal(place);
  await writeLocal(
    place,
    existing.filter((item) => item.id !== scanId),
  );
  if (!place.client) return true;
  try {
    const { error } = await place.client.from('scan_history').delete().eq('id', scanId);
    return !error;
  } catch {
    return false;
  }
}
