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

describe('createLocalMarketplaceRepository moderation', () => {
  const base = {
    title: 'Pentax K1000',
    askingPrice: 4500,
    category: 'collectibles' as const,
    condition: 'good' as const,
    area: 'cebu-city' as const,
  };
  const repository = () =>
    createLocalMarketplaceRepository({
      store: createMemoryStore(),
      viewer: { userId: 'usr_1' as never, handle: 'maya_sells' },
      seedListings: [],
      seedSaved: [],
    });

  it('holds a listing whose words break the rules, and screens an edit again', async () => {
    const repo = repository();
    const held = await repo.publish({ ...base, description: 'Text me on viber for less.' });
    expect(held.ok && held.value.moderationStatus).toBe('held');
    if (!held.ok) return;

    const cleaned = await repo.update(held.value.id, { description: 'Clean viewfinder.' });
    expect(cleaned.ok && cleaned.value.moderationStatus).toBe('approved');

    const repriced = await repo.update(held.value.id, { askingPrice: 4400 });
    expect(repriced.ok && repriced.value.moderationStatus).toBe('approved');
  });
});

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
    const insertedListings: Record<string, unknown>[] = [];
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
      lat: null,
      lng: null,
      description: 'Clean viewfinder.',
      estimate_php: 4200,
      estimate_low_php: 3600,
      estimate_high_php: 4800,
      verdict: 'just_right',
      verdict_share: 82,
      views_count: 14,
      saves_count: 2,
      status: 'active',
      moderation_status: 'approved',
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
                // The seller's sold listings, for their sales count.
                in: async () => ({
                  data: [{ seller_id: 'usr_1' }, { seller_id: 'usr_1' }],
                  error: null,
                }),
              }),
            }),
            insert: (payload: Record<string, unknown>) => {
              insertedListings.push(payload);
              return {
                select: () => ({
                  single: async () => ({ data: sampleRow, error: null }),
                }),
              };
            },
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
      // Nobody is rated yet; sales is how many of the seller's listings sold.
      expect(listed.value[0]?.seller.rating).toBeNull();
      expect(listed.value[0]?.seller.sales).toBe(2);
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
      estimatePhp: 99999,
      estimateLowPhp: 90000,
      estimateHighPhp: 100000,
    });
    expect(published.ok).toBe(true);
    // The AI estimate is the database's to copy from the scan, so it is never sent.
    expect(insertedListings[0]).not.toHaveProperty('estimate_php');
    expect(insertedListings[0]).not.toHaveProperty('estimate_low_php');
    expect(insertedListings[0]).not.toHaveProperty('estimate_high_php');
    if (published.ok) expect(published.value.estimatePhp).toBe(4200);
    expect(scanUpdates).toContainEqual({ id: 'scan_1', status: 'listed' });

    const sold = await repo.update('pentax-k1000-00000000', { status: 'sold' });
    expect(sold.ok).toBe(true);
    expect(scanUpdates).toContainEqual({ id: 'scan_1', status: 'sold' });
  });
});

describe('listing moderation in the Supabase repository', () => {
  const row = {
    id: '00000000-0000-4000-fc00-000000000001',
    slug: 'pentax-k1000-00000000',
    seller_id: 'usr_1',
    scan_id: null,
    title: 'Pentax K1000',
    asking_php: 4500,
    photo_url: null,
    photo_path: null,
    category: 'collectibles',
    condition: 'good',
    area: 'cebu-city',
    lat: null,
    lng: null,
    description: 'Clean viewfinder.',
    estimate_php: null,
    estimate_low_php: null,
    estimate_high_php: null,
    verdict: null,
    verdict_share: null,
    views_count: 0,
    saves_count: 0,
    status: 'active',
    moderation_status: 'pending',
    created_at: '2026-11-10T10:00:00.000Z',
    seller: { id: 'usr_1', handle: 'maya_sells', display_name: 'Maya', avatar_url: null },
  };

  function clientWith(invoke: jest.Mock) {
    return {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'usr_1' } } } }) },
      functions: { invoke },
      from: (table: string) => {
        if (table !== 'listings') return {};
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: row, error: null }) }) }),
          select: () => ({
            eq: () => ({
              neq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
              in: async () => ({ data: [], error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: () => ({
              select: () => ({
                single: async () => ({ data: { ...row, ...patch }, error: null }),
              }),
            }),
          }),
        };
      },
    };
  }
  const input = {
    title: 'Pentax K1000',
    askingPrice: 4500,
    category: 'collectibles' as const,
    condition: 'good' as const,
    area: 'cebu-city' as const,
    description: 'Clean viewfinder.',
  };

  it('screens a new listing right after publishing it and returns the outcome', async () => {
    const invoke = jest.fn(async () => ({ data: { status: 'approved' }, error: null }));
    const repo = createSupabaseMarketplaceRepository(clientWith(invoke) as never, {
      upload: async () => null,
      links: async () => ({}),
      remove: async () => true,
    });

    const published = await repo.publish(input);

    expect(invoke).toHaveBeenCalledWith('moderate-content', {
      body: { type: 'listing', id: row.id },
    });
    expect(published.ok && published.value.moderationStatus).toBe('approved');
  });

  it('leaves a listing pending when screening can’t be reached', async () => {
    const invoke = jest.fn(async () => {
      throw new Error('offline');
    });
    const repo = createSupabaseMarketplaceRepository(clientWith(invoke) as never, {
      upload: async () => null,
      links: async () => ({}),
      remove: async () => true,
    });

    const published = await repo.publish(input);

    expect(published.ok && published.value.moderationStatus).toBe('pending');
  });

  it('screens again when an edit sent the listing back to pending, and not otherwise', async () => {
    const invoke = jest.fn(async () => ({ data: { status: 'held' }, error: null }));
    const repo = createSupabaseMarketplaceRepository(clientWith(invoke) as never, {
      upload: async () => null,
      links: async () => ({}),
      remove: async () => true,
    });

    // The mock database echoes the patch; a changed title leaves the row pending.
    const reworded = await repo.update(row.slug, { title: 'Pentax K1000 film camera' });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(reworded.ok && reworded.value.moderationStatus).toBe('held');

    // A row the database left approved (price only) isn't screened again.
    invoke.mockClear();
    const approvedRow = { ...row, moderation_status: 'approved' };
    const client = clientWith(invoke) as unknown as { from: (t: string) => unknown };
    const original = client.from.bind(client);
    client.from = (table: string) => ({
      ...(original(table) as object),
      update: (patch: Record<string, unknown>) => ({
        eq: () => ({
          select: () => ({
            single: async () => ({ data: { ...approvedRow, ...patch }, error: null }),
          }),
        }),
      }),
    });
    const repriced = await createSupabaseMarketplaceRepository(client as never, {
      upload: async () => null,
      links: async () => ({}),
      remove: async () => true,
    }).update(row.slug, { askingPrice: 4400 });
    expect(invoke).not.toHaveBeenCalled();
    expect(repriced.ok && repriced.value.moderationStatus).toBe('approved');
  });
});

describe('saving a listing in the Supabase repository', () => {
  const listingId = '00000000-0000-4000-fc00-000000000001';
  const listingRow = {
    id: listingId,
    slug: 'pentax-k1000-00000000',
    seller_id: 'usr_seller',
    scan_id: null,
    title: 'Pentax K1000',
    asking_php: 4500,
    photo_url: null,
    photo_path: null,
    category: 'collectibles',
    condition: 'good',
    area: 'cebu-city',
    lat: null,
    lng: null,
    description: '',
    estimate_php: null,
    estimate_low_php: null,
    estimate_high_php: null,
    verdict: null,
    verdict_share: null,
    views_count: 0,
    saves_count: 0,
    status: 'active',
    moderation_status: 'approved',
    created_at: '2026-11-10T10:00:00.000Z',
    seller: { id: 'usr_seller', handle: 'maya_sells', display_name: 'Maya', avatar_url: null },
  };

  /**
   * A saved_listings table like the live one: insert(listing_id, alert_below_php, alert_enabled)
   * and update(alert_below_php, alert_enabled) only. Anything else, including an upsert whose DO
   * UPDATE rewrites listing_id, is refused with 42501.
   */
  function savedClient(existing: Record<string, unknown> | null, insertFailsWith?: string) {
    const calls: { op: string; payload?: Record<string, unknown>; filters: [string, unknown][] }[] =
      [];
    let saved = existing;
    const refused = { code: '42501', message: 'permission denied for table saved_listings' };
    const table = {
      update: (payload: Record<string, unknown>) => {
        const filters: [string, unknown][] = [];
        calls.push({ op: 'update', payload, filters });
        const chain = {
          eq: (column: string, value: unknown) => {
            filters.push([column, value]);
            return chain;
          },
          select: async () => {
            if (
              Object.keys(payload).some((k) => k !== 'alert_below_php' && k !== 'alert_enabled')
            ) {
              return { data: null, error: refused };
            }
            if (saved) saved = { ...saved, ...payload };
            return { data: saved ? [{ listing_id: listingId }] : [], error: null };
          },
        };
        return chain;
      },
      insert: async (payload: Record<string, unknown>) => {
        calls.push({ op: 'insert', payload, filters: [] });
        const allowed = ['listing_id', 'alert_below_php', 'alert_enabled'];
        if (Object.keys(payload).some((key) => !allowed.includes(key))) return { error: refused };
        if (insertFailsWith) {
          saved = { listing_id: listingId, alert_below_php: 1, alert_enabled: true };
          return { error: { code: insertFailsWith, message: 'duplicate key' } };
        }
        saved = payload;
        return { error: null };
      },
      upsert: async () => {
        calls.push({ op: 'upsert', filters: [] });
        return { error: refused };
      },
    };
    const client = {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'usr_buyer' } } } }) },
      from: (name: string) => {
        if (name === 'saved_listings') return table;
        if (name === 'listings') {
          return {
            select: () => ({
              eq: () => ({
                neq: () => ({ maybeSingle: async () => ({ data: listingRow, error: null }) }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${name}`);
      },
    };
    const repo = createSupabaseMarketplaceRepository(client as never, {
      upload: async () => null,
      links: async () => ({}),
    });
    return { repo, calls, current: () => saved };
  }

  it('saves a new listing with an update that changes nothing, then an insert without user_id', async () => {
    const { repo, calls, current } = savedClient(null);
    const saved = await repo.saveListing('pentax-k1000-00000000', 4000, true);
    expect(saved).toEqual({
      ok: true,
      value: { listingId: 'pentax-k1000-00000000', alertBelow: 4000, on: true },
    });
    expect(calls.map((call) => call.op)).toEqual(['update', 'insert']);
    expect(calls[1]?.payload).toEqual({
      listing_id: listingId,
      alert_below_php: 4000,
      alert_enabled: true,
    });
    expect(current()).toMatchObject({ alert_below_php: 4000 });
  });

  it('changes the alert of a listing that is already saved without inserting or upserting', async () => {
    const { repo, calls, current } = savedClient({
      listing_id: listingId,
      alert_below_php: 4050,
      alert_enabled: true,
    });
    const changed = await repo.saveListing('pentax-k1000-00000000', 3800, false);
    expect(changed.ok).toBe(true);
    expect(calls.map((call) => call.op)).toEqual(['update']);
    expect(calls[0]?.payload).toEqual({ alert_below_php: 3800, alert_enabled: false });
    expect(calls[0]?.filters).toEqual([['listing_id', listingId]]);
    expect(current()).toMatchObject({ alert_below_php: 3800, alert_enabled: false });
  });

  it('never upserts and never sends user_id', async () => {
    const { repo, calls } = savedClient(null);
    await repo.saveListing('pentax-k1000-00000000');
    await repo.saveListing('pentax-k1000-00000000', 3500);
    expect(calls.some((call) => call.op === 'upsert')).toBe(false);
    for (const call of calls) expect(call.payload ?? {}).not.toHaveProperty('user_id');
  });

  it('changes the save another tab just made instead of failing', async () => {
    const { repo, calls, current } = savedClient(null, '23505');
    const saved = await repo.saveListing('pentax-k1000-00000000', 3900);
    expect(saved.ok).toBe(true);
    expect(calls.map((call) => call.op)).toEqual(['update', 'insert', 'update']);
    expect(current()).toMatchObject({ alert_below_php: 3900 });
  });

  it('returns the error when saving is refused', async () => {
    const { repo } = savedClient(null, '42501');
    const saved = await repo.saveListing('pentax-k1000-00000000', 3900);
    expect(saved).toEqual({
      ok: false,
      error: { kind: 'authorization', code: 'not_found_or_denied' },
    });
  });
});

describe('how many chats a listing has', () => {
  const rowFor = (id: string, sellerId: string) => ({
    id,
    slug: `slug-${id}`,
    seller_id: sellerId,
    scan_id: null,
    title: `Item ${id}`,
    asking_php: 1000,
    photo_url: null,
    photo_path: null,
    category: 'collectibles',
    condition: 'good',
    area: 'cebu-city',
    lat: null,
    lng: null,
    description: '',
    estimate_php: null,
    estimate_low_php: null,
    estimate_high_php: null,
    verdict: null,
    verdict_share: null,
    views_count: 0,
    saves_count: 0,
    status: 'active',
    moderation_status: 'approved',
    created_at: '2026-11-10T10:00:00.000Z',
    seller: { id: sellerId, handle: 'someone', display_name: '', avatar_url: null },
  });

  /** `mine` is the viewer's; `theirs` is someone else's. Conversations answer as the viewer sees them. */
  function clientWith(conversations: { data: unknown; error: unknown } | 'throws') {
    const rows = [rowFor('mine-1', 'usr_me'), rowFor('theirs-1', 'usr_other')];
    return {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'usr_me' } } } }) },
      from: (table: string) => {
        if (table === 'conversations') {
          return {
            select: () => ({
              in: async () => {
                if (conversations === 'throws') throw new Error('offline');
                return conversations;
              },
              eq: () => ({
                eq: async () => ({ count: 0, error: null }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            neq: () => ({
              order: () => ({ limit: async () => ({ data: rows, error: null }) }),
              maybeSingle: async () => ({ data: rows[0], error: null }),
            }),
            eq: () => ({
              neq: () => ({ maybeSingle: async () => ({ data: rows[0], error: null }) }),
              in: async () => ({ data: [], error: null }),
            }),
            in: async () => ({ data: [], error: null }),
          }),
        };
      },
    };
  }
  const photos = { upload: async () => null, links: async () => ({}), remove: async () => true };

  it('counts the owner’s chats in the list, and leaves other people’s listings unknown', async () => {
    const repo = createSupabaseMarketplaceRepository(
      clientWith({
        data: [{ listing_id: 'mine-1' }, { listing_id: 'mine-1' }, { listing_id: 'mine-1' }],
        error: null,
      }) as never,
      photos,
    );
    const listed = await repo.list();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const byId = Object.fromEntries(listed.value.map((entry) => [entry.rowId, entry.stats.chats]));
    expect(byId).toEqual({ 'mine-1': 3, 'theirs-1': null });
  });

  it('says 0 for the owner’s listing with no chats, and the same in the list as on its own page', async () => {
    const repo = createSupabaseMarketplaceRepository(
      clientWith({ data: [], error: null }) as never,
      photos,
    );
    const listed = await repo.list();
    const found = await repo.findById('mine-1');
    expect(listed.ok && found.ok).toBe(true);
    if (!listed.ok || !found.ok) return;
    expect(listed.value.find((entry) => entry.rowId === 'mine-1')?.stats.chats).toBe(0);
    expect(found.value?.stats.chats).toBe(0);
  });

  it('is unknown, not 0, when the chats could not be counted', async () => {
    for (const failing of [
      { data: null, error: { code: '57014', message: 'timeout' } },
      'throws' as const,
    ]) {
      const repo = createSupabaseMarketplaceRepository(clientWith(failing) as never, photos);
      const listed = await repo.list();
      expect(listed.ok).toBe(true);
      if (!listed.ok) return;
      expect(listed.value.find((entry) => entry.rowId === 'mine-1')?.stats.chats).toBeNull();
    }
  });

  it('derives photo_path from scanId when publish omits photoPath', async () => {
    const inserted: Record<string, unknown>[] = [];
    const sampleRow = {
      id: '00000000-0000-4000-fc00-000000000099',
      slug: 'camera-00000099',
      seller_id: 'usr_1',
      scan_id: 'scan_99',
      title: 'Camera',
      asking_php: 2500,
      photo_path: 'usr_1/scan_99.jpg',
      category: 'electronics',
      condition: 'good',
      area: 'cebu-city',
      lat: null,
      lng: null,
      description: 'Clean body.',
      estimate_php: 2600,
      estimate_low_php: 2200,
      estimate_high_php: 3000,
      verdict: null,
      verdict_share: null,
      status: 'active',
      moderation_status: 'approved',
      views_count: 0,
      saves_count: 0,
      created_at: '2026-11-10T10:00:00.000Z',
      seller: { id: 'usr_1', handle: 'maya', display_name: 'Maya Reyes', avatar_url: null },
    };
    const client = {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'usr_1' } } } }) },
      from: (table: string) => {
        if (table === 'listings') {
          return {
            insert: (payload: Record<string, unknown>) => {
              inserted.push(payload);
              return { select: () => ({ single: async () => ({ data: sampleRow, error: null }) }) };
            },
            select: () => ({
              eq: () => ({ in: async () => ({ data: [], error: null }) }),
            }),
          };
        }
        if (table === 'scan_history') {
          return { update: () => ({ eq: async () => ({ error: null }) }) };
        }
        return {};
      },
      functions: {
        invoke: async () => ({ data: { status: 'approved' }, error: null }),
      },
    };
    const photoStore = {
      upload: async () => null,
      links: async (paths: readonly string[]) =>
        Object.fromEntries(paths.map((path) => [path, `https://signed.test/${path}`])),
      remove: async () => true,
    };

    const repo = createSupabaseMarketplaceRepository(client as never, photoStore);
    const published = await repo.publish({
      scanId: 'scan_99',
      title: 'Camera',
      askingPrice: 2500,
      category: 'electronics',
      condition: 'good',
      area: 'cebu-city',
      description: 'Clean body.',
    });

    expect(inserted[0]?.photo_path).toBe('usr_1/scan_99.jpg');
    expect(published.ok).toBe(true);
    if (published.ok) {
      expect(published.value.photoUrl).toBe('https://signed.test/usr_1/scan_99.jpg');
    }
  });
});
