import type { SupabaseClient } from '@supabase/supabase-js';

import {
  deleteScan,
  loadScans,
  newScanId,
  saveScan,
  scanToPreviewItem,
  type KeyValueStore,
  type SavedScan,
  type ScanPlace,
} from './scan-history';

function createMemoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => map.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      map.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      map.delete(key);
    }),
  };
}

const sampleScan: SavedScan = {
  id: '6f1c2a9e-4b7d-4c3e-9a1f-2d8e5b7c4a10',
  title: 'Vintage Leather Jacket',
  estimate: 3500,
  lowPhp: 2800,
  highPhp: 4200,
  explanation: 'Genuine brown leather in great condition.',
  assumptions: ['Light surface wear.'],
  photoUri: 'file:///photo1.jpg',
  capturedOn: 'Nov 6, 2026',
  status: 'private',
};

const remoteRow = {
  id: '0b7a1d34-5e6f-4a8b-9c0d-1e2f3a4b5c6d',
  item_name: 'Rolex Watch',
  amount_php: 150000,
  low_php: 120000,
  high_php: 180000,
  explanation: 'Submariner model in good state.',
  assumptions: [],
  photo_uri: 'file:///rolex.jpg',
  status: 'listed',
  created_at: '2026-11-06T10:00:00.000Z',
};

/** A stand-in Supabase: `scan_history` answers with `rows`, and inserts fail while `offline`. */
function fakeSupabase(rows: (typeof remoteRow)[] = []) {
  const state = { rows: [...rows], offline: false };
  const insert = jest.fn(async (row: Record<string, unknown>) => {
    if (state.offline) return { error: { message: 'offline' } };
    state.rows.unshift({ ...remoteRow, ...row, created_at: '2026-11-07T10:00:00.000Z' } as never);
    return { error: null };
  });
  const ownerFilter = jest.fn();
  const deleteEq = jest.fn(async (_column: string, id: string) => {
    state.rows = state.rows.filter((row) => row.id !== id);
    return { error: null };
  });
  const client = {
    from: jest.fn(() => ({
      insert,
      select: () => ({
        eq: (column: string, value: string) => {
          ownerFilter(column, value);
          return {
            order: async () =>
              state.offline
                ? { data: null, error: { message: 'offline' } }
                : { data: state.rows, error: null },
          };
        },
      }),
      delete: () => ({ eq: deleteEq }),
    })),
  } as unknown as SupabaseClient;
  return { client, state, insert, ownerFilter, deleteEq };
}

describe('scan-history', () => {
  let store: KeyValueStore;
  const onDevice = (): ScanPlace => ({ store, client: null, owner: 'device' });

  beforeEach(() => {
    store = createMemoryStore();
  });

  it('maps a SavedScan to a PreviewHistoryItem', () => {
    expect(scanToPreviewItem(sampleScan)).toEqual({
      id: sampleScan.id,
      title: 'Vintage Leather Jacket',
      estimate: 3500,
      status: 'private',
      capturedOn: 'Nov 6, 2026',
      photo: { uri: 'file:///photo1.jpg' },
      photoLabel: 'Vintage Leather Jacket',
    });
  });

  it('makes ids Supabase accepts: version-4 UUIDs', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    for (let index = 0; index < 50; index += 1) expect(newScanId()).toMatch(uuid);
    expect(newScanId(() => 0)).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('saves, loads and deletes on the phone without a backend', async () => {
    expect(await saveScan(sampleScan, onDevice())).toBe('saved');
    expect(await loadScans(onDevice())).toEqual([{ ...sampleScan, synced: false }]);

    await deleteScan(sampleScan.id, onDevice());
    expect(await loadScans(onDevice())).toEqual([]);
  });

  it('keeps each account’s scans apart on a shared phone', async () => {
    await saveScan(sampleScan, { store, client: null, owner: 'ana' });
    expect(await loadScans({ store, client: null, owner: 'ben' })).toEqual([]);
    expect(await loadScans({ store, client: null, owner: 'ana' })).toHaveLength(1);
  });

  it('saves to Supabase as the signed-in person, never naming an owner itself', async () => {
    const supabase = fakeSupabase();
    const place = { store, client: supabase.client, owner: 'user-123' };

    expect(await saveScan(sampleScan, place)).toBe('saved');
    const sent = supabase.insert.mock.calls[0]![0];
    expect(sent).toEqual(
      expect.objectContaining({
        id: sampleScan.id,
        item_name: 'Vintage Leather Jacket',
        amount_php: 3500,
        photo_uri: 'file:///photo1.jpg',
      }),
    );
    expect(sent).not.toHaveProperty('user_id');
  });

  it('keeps a scan on the phone when Supabase can’t take it, and sends it later', async () => {
    const supabase = fakeSupabase();
    const place = { store, client: supabase.client, owner: 'user-123' };
    supabase.state.offline = true;

    expect(await saveScan(sampleScan, place)).toBe('pending');
    // Still offline: the phone's copy is shown.
    expect((await loadScans(place)).map((scan) => scan.id)).toEqual([sampleScan.id]);

    // Back online: it's sent, and Supabase has it.
    supabase.state.offline = false;
    const loaded = await loadScans(place);
    expect(loaded.map((scan) => scan.id)).toEqual([sampleScan.id]);
    expect(loaded[0]!.synced).toBe(true);
    expect(supabase.state.rows.map((row) => row.id)).toEqual([sampleScan.id]);
  });

  it('loads only the account’s own scans, and drops ones deleted on another device', async () => {
    const supabase = fakeSupabase([remoteRow]);
    const place = { store, client: supabase.client, owner: 'user-123' };

    expect(await saveScan(sampleScan, place)).toBe('saved');
    let loaded = await loadScans(place);
    expect(supabase.ownerFilter).toHaveBeenCalledWith('user_id', 'user-123');
    expect(loaded.map((scan) => scan.id)).toEqual([sampleScan.id, remoteRow.id]);

    // Deleted elsewhere: gone from Supabase, so it leaves this phone too.
    supabase.state.rows = supabase.state.rows.filter((row) => row.id !== sampleScan.id);
    loaded = await loadScans(place);
    expect(loaded.map((scan) => scan.id)).toEqual([remoteRow.id]);
  });

  it('deletes from the phone and from Supabase', async () => {
    const supabase = fakeSupabase();
    const place = { store, client: supabase.client, owner: 'user-123' };
    await saveScan(sampleScan, place);

    expect(await deleteScan(sampleScan.id, place)).toBe(true);
    expect(supabase.deleteEq).toHaveBeenCalledWith('id', sampleScan.id);
    expect(await loadScans(place)).toEqual([]);
  });
});
