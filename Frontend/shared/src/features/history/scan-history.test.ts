import type { SupabaseClient } from '@supabase/supabase-js';

import type { ScanPhotoStore } from '../../adapters/supabase/photo-storage';
import {
  DEVICE_PAID_PRICES_KEY,
  deleteScan,
  loadScans,
  newScanId,
  saveScan,
  scanToPreviewItem,
  setScanPaid,
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
  photo_path: null as string | null,
  paid_php: null as number | null,
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
    if (state.offline) return { error: { message: 'offline' } };
    state.rows = state.rows.filter((row) => row.id !== id);
    return { error: null };
  });
  const update = jest.fn((values: Record<string, unknown>) => ({
    eq: async (_column: string, id: string) => {
      if (state.offline) return { error: { message: 'offline' } };
      state.rows = state.rows.map((row) => (row.id === id ? { ...row, ...values } : row));
      return { error: null };
    },
  }));
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
      update,
      delete: () => ({ eq: deleteEq }),
    })),
  } as unknown as SupabaseClient;
  return { client, state, insert, update, ownerFilter, deleteEq };
}

/** A stand-in Storage: uploads fail while `offline`, and each path's link names it. */
function fakePhotos() {
  const state = { offline: false };
  const photos = {
    upload: jest.fn(async (owner: string, scanId: string, _uri: string) =>
      state.offline ? null : `${owner}/${scanId}.jpg`,
    ),
    links: jest.fn(async (paths: readonly string[]) =>
      Object.fromEntries(paths.map((path) => [path, `https://signed.test/${path}?token=t`])),
    ),
    remove: jest.fn(async (_path: string) => true),
  } satisfies ScanPhotoStore;
  return { photos, state };
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

  it('uploads the photo once the scan is saved, so every device can show it', async () => {
    const supabase = fakeSupabase();
    const { photos } = fakePhotos();
    const place = { store, client: supabase.client, owner: 'user-123', photos };

    expect(await saveScan(sampleScan, place)).toBe('saved');
    expect(photos.upload).toHaveBeenCalledWith('user-123', sampleScan.id, 'file:///photo1.jpg');
    expect(supabase.update).toHaveBeenCalledWith({
      photo_path: `user-123/${sampleScan.id}.jpg`,
    });

    const [loaded] = await loadScans(place);
    expect(loaded!.photoPath).toBe(`user-123/${sampleScan.id}.jpg`);
    expect(scanToPreviewItem(loaded!).photo).toEqual({
      uri: `https://signed.test/user-123/${sampleScan.id}.jpg?token=t`,
    });
  });

  it('shows the phone’s photo until the upload goes, then sends it on a later load', async () => {
    const supabase = fakeSupabase();
    const { photos, state } = fakePhotos();
    const place = { store, client: supabase.client, owner: 'user-123', photos };
    state.offline = true;

    // The scan is saved even though its photo has to wait.
    expect(await saveScan(sampleScan, place)).toBe('saved');
    let [loaded] = await loadScans(place);
    expect(loaded!.photoPending).toBe(true);
    expect(scanToPreviewItem(loaded!).photo).toEqual({ uri: 'file:///photo1.jpg' });

    state.offline = false;
    [loaded] = await loadScans(place);
    expect(loaded!.photoPending).toBe(false);
    expect(supabase.state.rows[0]!.photo_path).toBe(`user-123/${sampleScan.id}.jpg`);
    expect(scanToPreviewItem(loaded!).photo).toEqual({
      uri: `https://signed.test/user-123/${sampleScan.id}.jpg?token=t`,
    });
  });

  it('sends a photo saved offline once its scan reaches Supabase', async () => {
    const supabase = fakeSupabase();
    const { photos } = fakePhotos();
    const place = { store, client: supabase.client, owner: 'user-123', photos };
    supabase.state.offline = true;
    expect(await saveScan(sampleScan, place)).toBe('pending');
    expect(photos.upload).not.toHaveBeenCalled();

    supabase.state.offline = false;
    const [loaded] = await loadScans(place);
    expect(photos.upload).toHaveBeenCalledTimes(1);
    expect(loaded!.photoPath).toBe(`user-123/${sampleScan.id}.jpg`);
  });

  it('shows another device’s scan by its uploaded photo, and never uploads a path from there', async () => {
    const supabase = fakeSupabase([{ ...remoteRow, photo_path: `user-123/${remoteRow.id}.jpg` }]);
    const { photos } = fakePhotos();
    const place = { store, client: supabase.client, owner: 'user-123', photos };

    const [loaded] = await loadScans(place);
    expect(photos.upload).not.toHaveBeenCalled();
    expect(scanToPreviewItem(loaded!).photo).toEqual({
      uri: `https://signed.test/user-123/${remoteRow.id}.jpg?token=t`,
    });
    // Links run out, so the phone's copy never keeps them.
    expect(await store.getItem(`@snapworth/scan_history:user-123`)).not.toContain('signed.test');
  });

  it('deletes the photo along with the scan', async () => {
    const supabase = fakeSupabase();
    const { photos } = fakePhotos();
    const place = { store, client: supabase.client, owner: 'user-123', photos };
    await saveScan(sampleScan, place);

    expect(await deleteScan(sampleScan.id, place)).toBe(true);
    expect(photos.remove).toHaveBeenCalledWith(`user-123/${sampleScan.id}.jpg`);
  });

  it('keeps the scan, here and in Supabase, and its photo, when Supabase can’t delete it', async () => {
    const supabase = fakeSupabase();
    const { photos } = fakePhotos();
    const place = { store, client: supabase.client, owner: 'user-123', photos };
    await saveScan(sampleScan, place);

    supabase.state.offline = true;
    expect(await deleteScan(sampleScan.id, place)).toBe(false);
    expect(photos.remove).not.toHaveBeenCalled();

    supabase.state.offline = false;
    expect((await loadScans(place)).map((scan) => scan.id)).toEqual([sampleScan.id]);
    expect(supabase.state.rows.map((row) => row.id)).toEqual([sampleScan.id]);
  });

  describe('what was paid', () => {
    it('is kept on the scan, sent to Supabase as the owner’s', async () => {
      const supabase = fakeSupabase();
      const place = {
        store,
        client: supabase.client,
        owner: 'user-123',
        photos: fakePhotos().photos,
      };
      await saveScan(sampleScan, place);

      expect(await setScanPaid(sampleScan.id, 150, place)).toBe(true);
      expect(supabase.update).toHaveBeenLastCalledWith({ paid_php: 150 });
      let [loaded] = await loadScans(place);
      expect(loaded!.paidPhp).toBe(150);

      expect(await setScanPaid(sampleScan.id, null, place)).toBe(true);
      expect(supabase.update).toHaveBeenLastCalledWith({ paid_php: null });
      [loaded] = await loadScans(place);
      expect(loaded!.paidPhp).toBeUndefined();
    });

    it('set offline, stays on the phone and is sent on a later load', async () => {
      const supabase = fakeSupabase();
      const place = {
        store,
        client: supabase.client,
        owner: 'user-123',
        photos: fakePhotos().photos,
      };
      await saveScan(sampleScan, place);
      supabase.state.offline = true;

      expect(await setScanPaid(sampleScan.id, 150, place)).toBe(false);
      expect((await loadScans(place))[0]!.paidPhp).toBe(150);

      supabase.state.offline = false;
      const [loaded] = await loadScans(place);
      expect(loaded).toEqual(expect.objectContaining({ paidPhp: 150, paidPending: false }));
      expect(supabase.state.rows[0]!.paid_php).toBe(150);
    });

    it('goes along with a scan saved offline', async () => {
      const supabase = fakeSupabase();
      const place = {
        store,
        client: supabase.client,
        owner: 'user-123',
        photos: fakePhotos().photos,
      };
      supabase.state.offline = true;
      await saveScan(sampleScan, place);
      await setScanPaid(sampleScan.id, 90, place);

      supabase.state.offline = false;
      expect((await loadScans(place))[0]!.paidPhp).toBe(90);
      expect(supabase.state.rows[0]!.paid_php).toBe(90);
    });

    it('kept on this phone before moves onto the account’s own scans, once', async () => {
      const supabase = fakeSupabase([remoteRow]);
      const place = {
        store,
        client: supabase.client,
        owner: 'user-123',
        photos: fakePhotos().photos,
      };
      const someoneElses = '11111111-2222-4333-8444-555555555555';
      await store.setItem(
        DEVICE_PAID_PRICES_KEY,
        JSON.stringify({
          [remoteRow.id]: 90000,
          [someoneElses]: 300,
          'nike-neon-windbreaker': 180,
        }),
      );

      const [loaded] = await loadScans(place);
      expect(loaded!.paidPhp).toBe(90000);
      expect(supabase.state.rows[0]!.paid_php).toBe(90000);
      // Another account's price, and the sample's, stay on the phone.
      expect(JSON.parse((await store.getItem(DEVICE_PAID_PRICES_KEY))!)).toEqual({
        [someoneElses]: 300,
        'nike-neon-windbreaker': 180,
      });
    });

    it('kept on this phone never overwrites one the account already has', async () => {
      const supabase = fakeSupabase([{ ...remoteRow, paid_php: 120000 }]);
      const place = {
        store,
        client: supabase.client,
        owner: 'user-123',
        photos: fakePhotos().photos,
      };
      await store.setItem(DEVICE_PAID_PRICES_KEY, JSON.stringify({ [remoteRow.id]: 1 }));

      expect((await loadScans(place))[0]!.paidPhp).toBe(120000);
      expect(supabase.update).not.toHaveBeenCalled();
      expect(JSON.parse((await store.getItem(DEVICE_PAID_PRICES_KEY))!)).toEqual({});
    });

    it('kept on this phone moves onto its scans without a backend too', async () => {
      await saveScan(sampleScan, onDevice());
      await store.setItem(DEVICE_PAID_PRICES_KEY, JSON.stringify({ [sampleScan.id]: 75 }));

      expect((await loadScans(onDevice()))[0]!.paidPhp).toBe(75);
      expect((await loadScans(onDevice()))[0]!.paidPhp).toBe(75);
      expect(JSON.parse((await store.getItem(DEVICE_PAID_PRICES_KEY))!)).toEqual({});
    });
  });
});
