import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { PreviewHistoryItem, PreviewItemStatus } from '../preview/sample-data';

export const SCAN_HISTORY_STORAGE_KEY = '@snapworth/scan_history';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
}

export interface SavedScan {
  readonly id: string;
  readonly title: string;
  readonly estimate: number;
  readonly lowPhp: number;
  readonly highPhp: number;
  readonly explanation: string;
  readonly assumptions: readonly string[];
  readonly photoUri: string;
  readonly capturedOn: string;
  readonly status: PreviewItemStatus;
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

/**
 * Persists a new successful scan locally and syncs to Supabase if available.
 */
export async function saveScan(
  scan: SavedScan,
  client?: SupabaseClient | null,
  store: KeyValueStore = AsyncStorage,
): Promise<void> {
  // 1. Save locally to key-value store
  try {
    const raw = await store.getItem(SCAN_HISTORY_STORAGE_KEY);
    const existing: SavedScan[] = raw ? JSON.parse(raw) : [];
    const updated = [scan, ...existing.filter((item) => item.id !== scan.id)];
    await store.setItem(SCAN_HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // If local storage fails, still proceed to try remote
  }

  // 2. Sync to Supabase if client is provided
  if (client) {
    try {
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData?.session?.user?.id ?? null;

      await client.from('scan_history').insert({
        id: scan.id,
        user_id: userId,
        item_name: scan.title,
        amount_php: scan.estimate,
        low_php: scan.lowPhp,
        high_php: scan.highPhp,
        explanation: scan.explanation,
        assumptions: scan.assumptions,
        photo_uri: scan.photoUri,
        status: scan.status,
      });
    } catch {
      // Offline or network error; local copy is already saved
    }
  }
}

/**
 * Loads all scan history: combines remote Supabase items with local device storage.
 */
export async function loadScans(
  client?: SupabaseClient | null,
  store: KeyValueStore = AsyncStorage,
): Promise<SavedScan[]> {
  let localScans: SavedScan[] = [];
  try {
    const raw = await store.getItem(SCAN_HISTORY_STORAGE_KEY);
    if (raw) localScans = JSON.parse(raw);
  } catch {
    localScans = [];
  }

  if (!client) return localScans;

  try {
    const { data, error } = await client
      .from('scan_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const remoteScans: SavedScan[] = data.map((row) => ({
        id: row.id,
        title: row.item_name,
        estimate: row.amount_php,
        lowPhp: row.low_php,
        highPhp: row.high_php,
        explanation: row.explanation ?? '',
        assumptions: Array.isArray(row.assumptions) ? row.assumptions : [],
        photoUri: row.photo_uri ?? '',
        capturedOn: formatCapturedDate(new Date(row.created_at)),
        status: (row.status as PreviewItemStatus) || 'private',
      }));

      // Merge: remote take precedence for matching IDs, but keep unique local ones
      const remoteIds = new Set(remoteScans.map((r) => r.id));
      const combined = [
        ...remoteScans,
        ...localScans.filter((l) => !remoteIds.has(l.id)),
      ];

      // Cache updated list back to local storage
      void store.setItem(SCAN_HISTORY_STORAGE_KEY, JSON.stringify(combined)).catch(
        () => undefined,
      );

      return combined;
    }
  } catch {
    // If remote fails, return local scans
  }

  return localScans;
}

/**
 * Deletes a scan from local storage and remote database.
 */
export async function deleteScan(
  scanId: string,
  client?: SupabaseClient | null,
  store: KeyValueStore = AsyncStorage,
): Promise<void> {
  try {
    const raw = await store.getItem(SCAN_HISTORY_STORAGE_KEY);
    if (raw) {
      const existing: SavedScan[] = JSON.parse(raw);
      const filtered = existing.filter((item) => item.id !== scanId);
      await store.setItem(SCAN_HISTORY_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch {
    // Continue to remote
  }

  if (client) {
    try {
      await client.from('scan_history').delete().eq('id', scanId);
    } catch {
      // Handled
    }
  }
}
