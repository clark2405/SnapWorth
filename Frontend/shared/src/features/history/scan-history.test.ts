import type { SupabaseClient } from '@supabase/supabase-js';

import {
  deleteScan,
  loadScans,
  saveScan,
  scanToPreviewItem,
  type KeyValueStore,
  type SavedScan,
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
  id: 'test-scan-1',
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

describe('scan-history', () => {
  let store: KeyValueStore;

  beforeEach(() => {
    jest.clearAllMocks();
    store = createMemoryStore();
  });

  it('maps a SavedScan to a PreviewHistoryItem', () => {
    const preview = scanToPreviewItem(sampleScan);
    expect(preview).toEqual({
      id: 'test-scan-1',
      title: 'Vintage Leather Jacket',
      estimate: 3500,
      status: 'private',
      capturedOn: 'Nov 6, 2026',
      photo: { uri: 'file:///photo1.jpg' },
      photoLabel: 'Vintage Leather Jacket',
    });
  });

  it('saves and loads scans locally via KeyValueStore', async () => {
    await saveScan(sampleScan, null, store);
    const loaded = await loadScans(null, store);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(sampleScan);
  });

  it('deletes a scan from local storage', async () => {
    await saveScan(sampleScan, null, store);
    let loaded = await loadScans(null, store);
    expect(loaded).toHaveLength(1);

    await deleteScan('test-scan-1', null, store);
    loaded = await loadScans(null, store);
    expect(loaded).toHaveLength(0);
  });

  it('syncs save and delete with Supabase when client is provided', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    const mockEq = jest.fn().mockResolvedValue({ error: null });
    const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });

    const mockClient = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        }),
      },
      from: jest.fn((table: string) => {
        if (table === 'scan_history') {
          return {
            insert: mockInsert,
            delete: mockDelete,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient;

    await saveScan(sampleScan, mockClient, store);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-scan-1',
        user_id: 'user-123',
        item_name: 'Vintage Leather Jacket',
        amount_php: 3500,
        photo_uri: 'file:///photo1.jpg',
      }),
    );

    await deleteScan('test-scan-1', mockClient, store);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('id', 'test-scan-1');
  });

  it('merges remote Supabase items with local scans on load', async () => {
    const mockOrder = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'remote-1',
          item_name: 'Rolex Watch',
          amount_php: 150000,
          low_php: 120000,
          high_php: 180000,
          explanation: 'Submariner model in good state.',
          assumptions: [],
          photo_uri: 'file:///rolex.jpg',
          status: 'listed',
          created_at: '2026-11-06T10:00:00.000Z',
        },
      ],
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ order: mockOrder });
    const mockClient = {
      from: jest.fn().mockReturnValue({ select: mockSelect }),
    } as unknown as SupabaseClient;

    await saveScan(sampleScan, null, store);
    const combined = await loadScans(mockClient, store);

    expect(combined).toHaveLength(2);
    expect(combined[0].id).toBe('remote-1');
    expect(combined[1].id).toBe('test-scan-1');
  });
});
