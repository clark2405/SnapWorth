import { createLocalMarketplaceRepository } from '../local/marketplace-repository';
import { createSupabaseMarketplaceRepository } from './marketplace-repository';

function createMemoryStore() {
  const map = new Map<string, string>();
  return {
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe('createLocalMarketplaceRepository', () => {
  it('publishes, updates, saves, and removes listings on the device', async () => {
    const repo = createLocalMarketplaceRepository({
      store: createMemoryStore(),
      viewer: { userId: 'usr_1' as never, handle: 'maya_sells' },
      seedListings: [],
      seedSaved: [],
    });

    const published = await repo.publish({
      scanId: 'scan-1',
      title: 'Pentax K1000',
      askingPrice: 4500,
      category: 'collectibles',
      condition: 'good',
      area: 'cebu-city',
      description: 'Clean viewfinder and working light meter.',
      estimatePhp: 4200,
      estimateLowPhp: 3600,
      estimateHighPhp: 4800,
    });
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    expect(published.value.title).toBe('Pentax K1000');
    expect(published.value.askingPrice).toBe(4500);
    expect(published.value.mine).toBe(true);

    const saved = await repo.saveListing(published.value.id);
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.value.alertBelow).toBe(4050);
      expect(saved.value.on).toBe(true);
    }

    const updated = await repo.update(published.value.id, {
      askingPrice: 4100,
      status: 'sold',
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.askingPrice).toBe(4100);
      expect(updated.value.status).toBe('sold');
    }

    const seller = await repo.sellerByHandle('maya_sells');
    expect(seller.ok).toBe(true);

    const removed = await repo.remove(published.value.id);
    expect(removed.ok).toBe(true);

    const afterRemove = await repo.list();
    expect(afterRemove.ok && afterRemove.value).toEqual([]);
  });
});

describe('createSupabaseMarketplaceRepository', () => {
  it('maps rows, signs scan photo paths, and updates scan_history status on publish and mark sold', async () => {
    const scanUpdates: { id: string; status: string }[] = [];
    const sampleRow = {
      id: '00000000-0000-4000-fc00-000000000001',
      slug: 'pentax-k1000-00000000',
      seller_id: 'usr_1',
      scan_id: 'scan_1',
      title: 'Pentax K1000',
      asking_php: 4500,
      photo_url: null,
      photo_path: 'usr_1/scan_1.jpg',
      category: 'collectibles',
      condition: 'good',
      area: 'cebu-city',
      distance_km: 3,
      description: 'Clean viewfinder.',
      estimate_php: 4200,
      estimate_low_php: 3600,
      estimate_high_php: 4800,
      verdict: 'just_right',
      verdict_share: 82,
      views_count: 14,
      saves_count: 2,
      status: 'active',
      created_at: '2026-11-10T10:00:00.000Z',
      seller: {
        id: 'usr_1',
        handle: 'maya_sells',
        display_name: 'Maya Reyes',
        avatar_url: null,
      },
    };

    const client = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'usr_1' } } } }),
      },
      from: (table: string) => {
        if (table === 'scan_history') {
          return {
            update: (values: { status: string }) => ({
              eq: async (_col: string, id: string) => {
                scanUpdates.push({ id, status: values.status });
                return { error: null };
              },
            }),
          };
        }
        if (table === 'listings') {
          return {
            select: () => ({
              neq: () => ({
                order: () => ({
                  limit: async () => ({ data: [sampleRow], error: null }),
                }),
              }),
              eq: () => ({
                neq: () => ({
                  maybeSingle: async () => ({ data: sampleRow, error: null }),
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({ data: sampleRow, error: null }),
              }),
            }),
            update: (patch: Record<string, unknown>) => ({
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: { ...sampleRow, ...patch },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const photos = {
      upload: async () => 'usr_1/scan_1.jpg',
      links: async () => ({ 'usr_1/scan_1.jpg': 'https://signed.test/scan_1.jpg' }),
      remove: async () => true,
    };

    const repo = createSupabaseMarketplaceRepository(client as never, photos);

    const listed = await repo.list();
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value[0]?.photoUrl).toBe('https://signed.test/scan_1.jpg');
      expect(listed.value[0]?.seller.displayName).toBe('Maya Reyes');
      expect(listed.value[0]?.mine).toBe(true);
    }

    const published = await repo.publish({
      scanId: 'scan_1',
      title: 'Pentax K1000',
      askingPrice: 4500,
      photoPath: 'usr_1/scan_1.jpg',
      category: 'collectibles',
      condition: 'good',
      area: 'cebu-city',
      description: 'Clean viewfinder.',
    });
    expect(published.ok).toBe(true);
    expect(scanUpdates).toContainEqual({ id: 'scan_1', status: 'listed' });

    const sold = await repo.update('pentax-k1000-00000000', { status: 'sold' });
    expect(sold.ok).toBe(true);
    expect(scanUpdates).toContainEqual({ id: 'scan_1', status: 'sold' });
  });
});
