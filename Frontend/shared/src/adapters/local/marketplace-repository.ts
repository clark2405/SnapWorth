import type {
  MarketListing,
  MarketplaceRepository,
  SavedListingAlert,
  SellerProfile,
} from '../../ports/marketplace';
import type { UtcDateTime } from '../../types/date-time';
import type { PublicProfile } from '../../types/entities';
import { err, ok } from '../../types/result';
import type { KeyValueStore } from './comment-repository';
import { screenWithRules } from './screening';

const listingsKey = 'snapworth.marketplace.listings.v1';
const savedKey = 'snapworth.marketplace.saved.v1';

export type LocalSeedSeller = Omit<SellerProfile, 'listings'>;

export interface LocalMarketplaceRepositoryOptions {
  readonly store: KeyValueStore;
  readonly viewer: PublicProfile;
  readonly seedListings: readonly MarketListing[];
  readonly seedSaved: readonly SavedListingAlert[];
  readonly seedSellers?: readonly LocalSeedSeller[];
  readonly now?: () => Date;
}

const roundTo50 = (value: number) => Math.max(50, Math.round(value / 50) * 50);

function makeSlug(title: string, timestamp: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 44);
  return `${base.length >= 2 ? base : 'item'}-${timestamp.toString(36)}`;
}

/**
 * Market listings and saved price-drop alerts kept on this device, for a build without a Supabase
 * project. Follows the same rules as the database: only the seller edits, marks sold, or removes
 * their listing, and saving a listing updates its save count.
 */
export function createLocalMarketplaceRepository({
  store,
  viewer,
  seedListings,
  seedSaved,
  seedSellers = [],
  now = () => new Date(),
}: LocalMarketplaceRepositoryOptions): MarketplaceRepository {
  let listingsCache: MarketListing[] | null = null;
  let savedCache: SavedListingAlert[] | null = null;

  async function loadListings(): Promise<MarketListing[]> {
    if (listingsCache) return listingsCache;
    const raw = await store.getItem(listingsKey).catch(() => null);
    listingsCache = raw ? (JSON.parse(raw) as MarketListing[]) : [...seedListings];
    return listingsCache;
  }

  async function writeListings(next: MarketListing[]) {
    listingsCache = next;
    await store.setItem(listingsKey, JSON.stringify(next)).catch(() => undefined);
  }

  async function loadSaved(): Promise<SavedListingAlert[]> {
    if (savedCache) return savedCache;
    const raw = await store.getItem(savedKey).catch(() => null);
    savedCache = raw ? (JSON.parse(raw) as SavedListingAlert[]) : [...seedSaved];
    return savedCache;
  }

  async function writeSaved(next: SavedListingAlert[]) {
    savedCache = next;
    await store.setItem(savedKey, JSON.stringify(next)).catch(() => undefined);
  }

  const matchesKey = (listing: MarketListing, idOrSlug: string) =>
    listing.id === idOrSlug || listing.slug === idOrSlug || listing.rowId === idOrSlug;

  return {
    async list() {
      const all = await loadListings();
      const visible = all.filter((listing) => listing.status !== 'removed');
      return ok(visible);
    },

    async findById(idOrSlug) {
      const all = await loadListings();
      const found = all.find(
        (listing) => matchesKey(listing, idOrSlug) && listing.status !== 'removed',
      );
      return ok(found ?? null);
    },

    async sellerByHandle(handle) {
      const normalized = handle.trim().toLowerCase().replace(/^@/, '');
      const all = await loadListings();
      const activeListings = all.filter(
        (listing) =>
          listing.seller.handle.toLowerCase() === normalized && listing.status === 'active',
      );
      const seeded = seedSellers.find((entry) => entry.handle.toLowerCase() === normalized);
      const fromListing = all.find(
        (listing) => listing.seller.handle.toLowerCase() === normalized,
      )?.seller;

      if (!seeded && !fromListing) return ok(null);

      const profile: SellerProfile = {
        id: seeded?.id ?? fromListing?.id ?? `seller:${normalized}`,
        handle: seeded?.handle ?? fromListing?.handle ?? normalized,
        displayName: seeded?.displayName ?? fromListing?.displayName ?? normalized,
        avatarUrl: seeded?.avatarUrl ?? fromListing?.avatarUrl ?? null,
        rating: seeded?.rating ?? fromListing?.rating ?? '4.8',
        sales: seeded?.sales ?? fromListing?.sales ?? 0,
        joined: seeded?.joined ?? 'Joined 2026',
        bio: seeded?.bio ?? '',
        location: seeded?.location ?? 'Cebu City',
        listings: activeListings,
      };
      return ok(profile);
    },

    async publish(input) {
      const title = input.title.trim();
      if (title.length < 1 || title.length > 80 || input.askingPrice <= 0) {
        return err({ kind: 'validation', code: 'rejected', field: 'listing' });
      }
      const timestamp = now().getTime();
      const slug = makeSlug(title, timestamp);
      const listing: MarketListing = {
        id: slug,
        rowId: `local-listing-${timestamp.toString(36)}`,
        slug,
        scanId: input.scanId ?? null,
        title,
        askingPrice: Math.round(input.askingPrice),
        photoUrl: input.photoUrl ?? null,
        photoPath: input.photoPath ?? null,
        photoLabel: title,
        category: input.category,
        condition: input.condition,
        area: input.area,
        lat: null,
        lng: null,
        description: input.description.trim(),
        estimatePhp: input.estimatePhp ?? null,
        estimateLowPhp: input.estimateLowPhp ?? null,
        estimateHighPhp: input.estimateHighPhp ?? null,
        verdict: null,
        verdictShare: null,
        status: 'active',
        // The same development rules as the server's `rules` provider: held text stays private.
        moderationStatus: screenWithRules(`${title}\n${input.description}`),
        seller: {
          id: viewer.userId,
          handle: viewer.handle,
          displayName: viewer.handle,
          avatarUrl: viewer.avatarUrl ?? null,
          rating: '4.8',
          sales: 12,
        },
        stats: { views: 1, saves: 0, chats: 0 },
        createdAt: now().toISOString() as UtcDateTime,
        mine: true,
      };
      const all = await loadListings();
      await writeListings([listing, ...all]);
      return ok(listing);
    },

    async update(idOrSlug, change) {
      const all = await loadListings();
      const target = all.find((listing) => matchesKey(listing, idOrSlug));
      if (!target || !target.mine) {
        return err({ kind: 'authorization', code: 'not_found_or_denied' });
      }
      const nextTitle = change.title !== undefined ? change.title.trim() : target.title;
      const nextPrice =
        change.askingPrice !== undefined ? Math.round(change.askingPrice) : target.askingPrice;
      if (nextTitle.length < 1 || nextTitle.length > 80 || nextPrice <= 0) {
        return err({ kind: 'validation', code: 'rejected', field: 'listing' });
      }
      const updated: MarketListing = {
        ...target,
        title: nextTitle,
        askingPrice: nextPrice,
        category: change.category ?? target.category,
        condition: change.condition ?? target.condition,
        area: change.area ?? target.area,
        description:
          change.description !== undefined ? change.description.trim() : target.description,
        status: change.status ?? target.status,
        // New words are screened again, as the database does.
        moderationStatus:
          nextTitle !== target.title ||
          (change.description !== undefined && change.description.trim() !== target.description)
            ? screenWithRules(`${nextTitle}\n${change.description ?? target.description}`)
            : target.moderationStatus,
      };
      await writeListings(
        all.map((listing) => (listing.rowId === target.rowId ? updated : listing)),
      );
      return ok(updated);
    },

    async remove(idOrSlug) {
      const all = await loadListings();
      const target = all.find((listing) => matchesKey(listing, idOrSlug));
      if (!target || !target.mine) {
        return err({ kind: 'authorization', code: 'not_found_or_denied' });
      }
      await writeListings(all.filter((listing) => listing.rowId !== target.rowId));
      const saved = await loadSaved();
      await writeSaved(saved.filter((entry) => entry.listingId !== target.id));
      return ok(undefined);
    },

    async listSaved() {
      return ok(await loadSaved());
    },

    async saveListing(idOrSlug, alertBelow, on = true) {
      const all = await loadListings();
      const target = all.find(
        (listing) => matchesKey(listing, idOrSlug) && listing.status !== 'removed',
      );
      if (!target) {
        return err({ kind: 'authorization', code: 'not_found_or_denied' });
      }
      const saved = await loadSaved();
      const existing = saved.find((entry) => entry.listingId === target.id);
      const nextAlert: SavedListingAlert = {
        listingId: target.id,
        alertBelow:
          alertBelow !== undefined
            ? Math.max(1, Math.round(alertBelow))
            : (existing?.alertBelow ?? roundTo50(target.askingPrice * 0.9)),
        on,
      };
      const nextSaved = existing
        ? saved.map((entry) => (entry.listingId === target.id ? nextAlert : entry))
        : [nextAlert, ...saved];
      await writeSaved(nextSaved);
      if (!existing) {
        await writeListings(
          all.map((listing) =>
            listing.rowId === target.rowId
              ? { ...listing, stats: { ...listing.stats, saves: listing.stats.saves + 1 } }
              : listing,
          ),
        );
      }
      return ok(nextAlert);
    },

    async unsaveListing(idOrSlug) {
      const all = await loadListings();
      const target = all.find((listing) => matchesKey(listing, idOrSlug));
      const key = target?.id ?? idOrSlug;
      const saved = await loadSaved();
      const had = saved.some((entry) => entry.listingId === key);
      await writeSaved(saved.filter((entry) => entry.listingId !== key));
      if (had && target) {
        await writeListings(
          all.map((listing) =>
            listing.rowId === target.rowId
              ? {
                  ...listing,
                  stats: { ...listing.stats, saves: Math.max(0, listing.stats.saves - 1) },
                }
              : listing,
          ),
        );
      }
      return ok(undefined);
    },
  };
}
