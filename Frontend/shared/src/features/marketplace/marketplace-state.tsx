import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ImageSourcePropType } from 'react-native';

import type {
  MarketArea,
  MarketCategory,
  MarketListing,
  MarketplaceRepository,
  NewListingInput,
  SavedListingAlert,
  SellerProfile,
  UpdateListingInput,
} from '../../ports/marketplace';
import type { UtcDateTime } from '../../types/date-time';
import type { AppError } from '../../types/errors';
import { ok, type Result } from '../../types/result';
import {
  previewAvatarByHandle,
  previewListingDetail,
  previewListingInsight,
  previewListingPlaces,
  previewListings,
  previewListingWorth,
  previewMyListing,
  previewMyListingInsight,
  previewPhotoByListingKey,
  previewPriceAlerts,
  previewSellers,
  previewUsers,
  type PreviewListing,
  type PreviewUser,
} from '../preview/sample-data';

export type MarketplaceLoadStatus = 'loading' | 'ready' | 'failed';

const categoryBySeedSlug: Readonly<Record<string, MarketCategory>> = {
  'polaroid-sun-600': 'collectibles',
  'air-jordan-1-bred': 'sneakers',
  'retro-walkman': 'electronics',
  'keychron-keyboard': 'electronics',
  'nike-teal-windbreaker': 'fashion',
  'colour-block-windbreaker': 'fashion',
  'black-puffer-jacket': 'fashion',
  'polaroid-film-bundle': 'collectibles',
};

const sellerBySeedSlug: Readonly<Record<string, PreviewUser>> = {
  'polaroid-sun-600': previewUsers.mariaCruz,
  'air-jordan-1-bred': previewUsers.justinV,
  'retro-walkman': previewUsers.sugboHype,
  'keychron-keyboard': previewUsers.mariaCruz,
  'nike-teal-windbreaker': previewUsers.retroCurator,
  'colour-block-windbreaker': previewUsers.sugboHype,
  'black-puffer-jacket': previewUsers.justinV,
  'polaroid-film-bundle': previewUsers.mariaCruz,
};

const descriptionBySeedSlug: Readonly<Record<string, string>> = {
  'polaroid-sun-600': previewListingDetail.description,
  'air-jordan-1-bred':
    'Classic black and red Air Jordan 1 High. Clean uppers, minimal star loss on the soles, and comes with the original box and extra red laces.',
  'retro-walkman':
    'Silver portable cassette Walkman with working belt clip and fresh drive belt. Plays both sides of the tape cleanly with no warble.',
  'keychron-keyboard':
    'Hot-swappable wireless mechanical keyboard with tactile brown switches and RGB backlight. Includes original braided USB-C cable and Mac/Windows keycaps.',
  'nike-teal-windbreaker':
    'Early 90s Nike half-zip windbreaker in bright teal. Original swoosh embroidery, crisp nylon shell, elastic cuffs still tight.',
  'colour-block-windbreaker':
    'Teal and purple colour-block nylon shell jacket. Lightweight, zip runs smoothly, fits relaxed medium to large.',
  'black-puffer-jacket':
    'Matte black quilted puffer jacket with high collar and zip pockets. Warm without bulk, no snags or stains.',
  'polaroid-film-bundle':
    'Tested Polaroid 600 instant camera bundled with two fridge-stored colour film packs so you can shoot right away.',
};

/** Resolves a listing's photo: its remote/device URI when present, or the bundled sample photo. */
export function listingPhotoSource(
  listing: Pick<MarketListing, 'id' | 'slug' | 'photoUrl'>,
): ImageSourcePropType {
  if (listing.photoUrl && listing.photoUrl.trim().length > 0) {
    return { uri: listing.photoUrl };
  }
  return (
    previewPhotoByListingKey[listing.slug] ??
    previewPhotoByListingKey[listing.id] ??
    previewListingDetail.photo
  );
}

/** Resolves a seller's avatar: their uploaded URL when present, or the bundled sample avatar. */
export function sellerAvatarSource(seller: {
  readonly handle: string;
  readonly avatarUrl?: string | null;
}): ImageSourcePropType {
  if (seller.avatarUrl && seller.avatarUrl.trim().length > 0) {
    return { uri: seller.avatarUrl };
  }
  return previewAvatarByHandle[seller.handle] ?? previewUsers.mariaCruz.avatar;
}

/** Maps a `MarketListing` into the `PreviewListing` shape used by cards, Hanap and Guess. */
export function toPreviewListing(listing: MarketListing): PreviewListing {
  return {
    id: listing.id,
    title: listing.title,
    askingPrice: listing.askingPrice,
    photo: listingPhotoSource(listing),
    photoLabel: listing.photoLabel,
    verdict: listing.verdict,
    verdictShare: listing.verdictShare,
  };
}

/** Builds the preview owner's own sample listing (`nike-neon-windbreaker`). */
export function buildPreviewMyMarketListing(): MarketListing {
  return {
    id: previewMyListing.id,
    rowId: previewMyListing.id,
    slug: previewMyListing.id,
    scanId: previewMyListing.id,
    title: previewMyListing.title,
    askingPrice: previewMyListing.askingPrice,
    photoUrl: null,
    photoPath: null,
    photoLabel: previewMyListing.photoLabel,
    category: 'fashion',
    condition: 'like_new',
    area: 'cebu-city',
    lat: null,
    lng: null,
    description: previewMyListing.description,
    estimatePhp: previewMyListingInsight.estimate,
    estimateLowPhp: previewMyListingInsight.estimateLow,
    estimateHighPhp: previewMyListingInsight.estimateHigh,
    verdict: 'just_right',
    verdictShare: previewMyListing.justRightShare,
    status: 'active',
    seller: {
      id: `preview:${previewMyListing.seller.handle}`,
      handle: previewMyListing.seller.handle,
      displayName: 'Rico Santos',
      avatarUrl: null,
      rating: previewMyListing.seller.rating,
      sales: previewMyListing.seller.sales,
    },
    stats: previewMyListing.stats,
    createdAt: '2026-10-12T08:00:00.000Z' as UtcDateTime,
    mine: true,
  };
}

/** Builds the initial `MarketListing` seed from `sample-data.ts`. */
export function buildPreviewMarketListings(): MarketListing[] {
  return previewListings.map((entry, index) => {
    const worth = previewListingWorth[entry.id];
    const place = previewListingPlaces[entry.id];
    const seller = sellerBySeedSlug[entry.id] ?? previewUsers.mariaCruz;
    const sellerMeta = previewSellers[seller.handle];
    return {
      id: entry.id,
      rowId: `seed-listing-${index + 1}`,
      slug: entry.id,
      scanId: null,
      title: entry.title,
      askingPrice: entry.askingPrice,
      photoUrl: null,
      photoPath: null,
      photoLabel: entry.photoLabel,
      category: categoryBySeedSlug[entry.id] ?? 'collectibles',
      condition: 'good',
      area: (place?.area as MarketArea | undefined) ?? 'cebu-city',
      lat: null,
      lng: null,
      description: descriptionBySeedSlug[entry.id] ?? previewListingDetail.description,
      estimatePhp: worth?.estimate ?? previewListingInsight.estimate,
      estimateLowPhp: worth?.low ?? previewListingInsight.estimateLow,
      estimateHighPhp: worth?.high ?? previewListingInsight.estimateHigh,
      verdict: entry.verdict,
      verdictShare: entry.verdictShare,
      status: 'active',
      seller: {
        id: `preview:${seller.handle}`,
        handle: seller.handle,
        displayName: sellerMeta?.displayName ?? seller.handle,
        avatarUrl: null,
        rating: sellerMeta?.rating ?? '4.9',
        sales: sellerMeta?.sales ?? 42,
      },
      stats: {
        views: 180,
        saves: previewListingInsight.watchers,
        chats: 2,
      },
      createdAt: new Date(Date.now() - index * 3_600_000).toISOString() as UtcDateTime,
      mine: false,
    };
  });
}

export function buildPreviewSellerSeeds(): Omit<SellerProfile, 'listings'>[] {
  return [
    {
      id: 'preview:mariacruz',
      handle: 'mariacruz',
      displayName: 'Maria Cruz',
      avatarUrl: null,
      rating: '4.9',
      sales: 42,
      joined: 'Joined January 2026',
      bio: 'Film cameras and 90s electronics. Everything is tested before it is listed.',
      location: 'Cebu City',
    },
    {
      id: 'preview:retro_curator',
      handle: 'retro_curator',
      displayName: 'Rico Santos',
      avatarUrl: null,
      rating: '4.8',
      sales: 12,
      joined: 'Joined March 2026',
      bio: 'Thrifting 90s sportswear and film cameras around Cebu. Everything I sell is tested.',
      location: 'Lahug, Cebu City',
    },
    {
      id: 'preview:sugbo_hype',
      handle: 'sugbo_hype',
      displayName: 'Sugbo Hype',
      avatarUrl: null,
      rating: '4.8',
      sales: 19,
      joined: 'Joined February 2026',
      bio: 'Vintage streetwear, cassette audio and rare finds around Mandaue.',
      location: 'Mandaue',
    },
    {
      id: 'preview:justin_v',
      handle: 'justin_v',
      displayName: 'Justin V.',
      avatarUrl: null,
      rating: '4.9',
      sales: 27,
      joined: 'Joined January 2026',
      bio: 'Sneaker collector and outerwear enthusiast. Original boxes included.',
      location: 'Lapu-Lapu',
    },
  ];
}

export interface MarketplaceState {
  readonly status: MarketplaceLoadStatus;
  /** Active listings shown in Market, newest first. */
  readonly listings: readonly MarketListing[];
  /** Active listings in the `PreviewListing` shape for cards, Hanap and Guess. */
  readonly previewListings: readonly PreviewListing[];
  /** Saved listings & price alerts for the viewer. */
  readonly savedAlerts: readonly SavedListingAlert[];
  /** Finds a listing by id or slug (including the viewer's own listings). */
  readonly findListing: (idOrSlug: string | undefined) => MarketListing | null;
  /** Loads a seller profile by handle from the repository or current state. */
  readonly loadSeller: (handle: string) => Promise<SellerProfile | null>;
  /** Checks whether a listing is saved by the viewer. */
  readonly isSaved: (listingId: string) => boolean;
  /** Gets the price alert for a listing if saved. */
  readonly getAlert: (listingId: string) => SavedListingAlert | undefined;
  readonly refresh: () => Promise<void>;
  readonly publishListing: (input: NewListingInput) => Promise<Result<MarketListing, AppError>>;
  readonly updateListing: (
    idOrSlug: string,
    change: UpdateListingInput,
  ) => Promise<Result<MarketListing, AppError>>;
  readonly removeListing: (idOrSlug: string) => Promise<Result<void, AppError>>;
  readonly toggleSaved: (idOrSlug: string) => Promise<boolean>;
  readonly saveAlert: (
    idOrSlug: string,
    alertBelow?: number,
    on?: boolean,
  ) => Promise<Result<SavedListingAlert, AppError>>;
  readonly removeAlert: (idOrSlug: string) => Promise<Result<void, AppError>>;
}

const MarketplaceRepositoryContext = createContext<MarketplaceRepository | null>(null);
const MarketplaceStateContext = createContext<MarketplaceState | null>(null);

const roundTo50 = (value: number) => Math.max(50, Math.round(value / 50) * 50);

function useMarketplaceStateInternal(repository: MarketplaceRepository | null): MarketplaceState {
  const [status, setStatus] = useState<MarketplaceLoadStatus>(repository ? 'loading' : 'ready');
  const [allListings, setAllListings] = useState<readonly MarketListing[]>(() =>
    buildPreviewMarketListings(),
  );
  const [mySampleListing, setMySampleListing] = useState<MarketListing>(() =>
    buildPreviewMyMarketListing(),
  );
  const [savedAlerts, setSavedAlerts] = useState<readonly SavedListingAlert[]>(() =>
    previewPriceAlerts.map((entry) => ({ ...entry })),
  );

  const refresh = useCallback(async () => {
    if (!repository) {
      setStatus('ready');
      return;
    }
    const [listingsResult, savedResult] = await Promise.all([
      repository.list(),
      repository.listSaved(),
    ]);
    if (listingsResult.ok) {
      setAllListings(listingsResult.value);
      setStatus('ready');
    } else {
      setStatus((current) => (current === 'ready' ? 'ready' : 'failed'));
    }
    if (savedResult.ok) {
      setSavedAlerts(savedResult.value);
    }
  }, [repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeListings = useMemo(
    () => allListings.filter((listing) => listing.status === 'active'),
    [allListings],
  );

  const mappedPreviewListings = useMemo(
    () => activeListings.map(toPreviewListing),
    [activeListings],
  );

  const findListing = useCallback(
    (idOrSlug: string | undefined): MarketListing | null => {
      if (!idOrSlug) return activeListings[0] ?? buildPreviewMarketListings()[0] ?? null;
      const inList = allListings.find(
        (entry) =>
          (entry.id === idOrSlug || entry.slug === idOrSlug || entry.rowId === idOrSlug) &&
          entry.status !== 'removed',
      );
      if (inList) return inList;
      if (idOrSlug === mySampleListing.id && mySampleListing.status !== 'removed') {
        return mySampleListing;
      }
      const fallback = buildPreviewMarketListings().find((entry) => entry.id === idOrSlug);
      return fallback ?? activeListings[0] ?? buildPreviewMarketListings()[0] ?? null;
    },
    [activeListings, allListings, mySampleListing],
  );

  const loadSeller = useCallback(
    async (handle: string): Promise<SellerProfile | null> => {
      const normalized = handle.trim().toLowerCase().replace(/^@/, '');
      if (repository) {
        const result = await repository.sellerByHandle(normalized);
        if (result.ok && result.value) return result.value;
      }
      const seedSeller = previewSellers[normalized];
      const seedMeta = buildPreviewSellerSeeds().find(
        (entry) => entry.handle.toLowerCase() === normalized,
      );
      const sellerListings = activeListings.filter((entry) =>
        seedSeller
          ? seedSeller.listingIds.includes(entry.id)
          : entry.seller.handle.toLowerCase() === normalized,
      );
      if (!seedSeller && !seedMeta && sellerListings.length === 0) return null;
      return {
        id: seedMeta?.id ?? `preview:${normalized}`,
        handle: seedSeller?.user.handle ?? seedMeta?.handle ?? normalized,
        displayName: seedSeller?.displayName ?? seedMeta?.displayName ?? normalized,
        avatarUrl: seedMeta?.avatarUrl ?? null,
        rating: seedSeller?.rating ?? seedMeta?.rating ?? '4.9',
        sales: seedSeller?.sales ?? seedMeta?.sales ?? 0,
        joined: seedSeller?.joined ?? seedMeta?.joined ?? 'Joined January 2026',
        bio: seedSeller?.bio ?? seedMeta?.bio ?? '',
        location: seedMeta?.location ?? 'Cebu City',
        listings: sellerListings,
      };
    },
    [activeListings, repository],
  );

  const isSaved = useCallback(
    (listingId: string) => savedAlerts.some((entry) => entry.listingId === listingId),
    [savedAlerts],
  );

  const getAlert = useCallback(
    (listingId: string) => savedAlerts.find((entry) => entry.listingId === listingId),
    [savedAlerts],
  );

  const publishListing = useCallback(
    async (input: NewListingInput): Promise<Result<MarketListing, AppError>> => {
      if (repository) {
        const result = await repository.publish(input);
        if (result.ok) {
          setAllListings((current) => [
            result.value,
            ...current.filter((entry) => entry.rowId !== result.value.rowId),
          ]);
        }
        return result;
      }
      const slug = `${input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)}-${Date.now().toString(36)}`;
      const created: MarketListing = {
        id: slug,
        rowId: slug,
        slug,
        scanId: input.scanId ?? null,
        title: input.title.trim(),
        askingPrice: Math.round(input.askingPrice),
        photoUrl: input.photoUrl ?? null,
        photoPath: input.photoPath ?? null,
        photoLabel: input.title.trim(),
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
        seller: {
          id: 'preview:retro_curator',
          handle: previewUsers.retroCurator.handle,
          displayName: 'Rico Santos',
          avatarUrl: null,
          rating: '4.8',
          sales: 12,
        },
        stats: { views: 1, saves: 0, chats: 0 },
        createdAt: new Date().toISOString() as UtcDateTime,
        mine: true,
      };
      setAllListings((current) => [created, ...current]);
      return ok(created);
    },
    [repository],
  );

  const updateListing = useCallback(
    async (
      idOrSlug: string,
      change: UpdateListingInput,
    ): Promise<Result<MarketListing, AppError>> => {
      if (repository) {
        const result = await repository.update(idOrSlug, change);
        if (result.ok) {
          setAllListings((current) =>
            current.map((entry) =>
              entry.rowId === result.value.rowId || entry.id === idOrSlug ? result.value : entry,
            ),
          );
        }
        return result;
      }
      const target = findListing(idOrSlug);
      if (!target) {
        return ok(mySampleListing);
      }
      const updated: MarketListing = {
        ...target,
        title: change.title !== undefined ? change.title.trim() : target.title,
        askingPrice:
          change.askingPrice !== undefined ? Math.round(change.askingPrice) : target.askingPrice,
        category: change.category ?? target.category,
        condition: change.condition ?? target.condition,
        area: change.area ?? target.area,
        description:
          change.description !== undefined ? change.description.trim() : target.description,
        status: change.status ?? target.status,
      };
      if (idOrSlug === mySampleListing.id) {
        setMySampleListing(updated);
      }
      setAllListings((current) =>
        current.map((entry) =>
          entry.id === idOrSlug || entry.slug === idOrSlug ? updated : entry,
        ),
      );
      return ok(updated);
    },
    [findListing, mySampleListing, repository],
  );

  const removeListing = useCallback(
    async (idOrSlug: string): Promise<Result<void, AppError>> => {
      if (repository) {
        const result = await repository.remove(idOrSlug);
        if (result.ok) {
          setAllListings((current) =>
            current.filter(
              (entry) =>
                entry.id !== idOrSlug && entry.slug !== idOrSlug && entry.rowId !== idOrSlug,
            ),
          );
          setSavedAlerts((current) => current.filter((entry) => entry.listingId !== idOrSlug));
        }
        return result;
      }
      if (idOrSlug === mySampleListing.id) {
        setMySampleListing((current) => ({ ...current, status: 'removed' }));
      }
      setAllListings((current) =>
        current.filter((entry) => entry.id !== idOrSlug && entry.slug !== idOrSlug),
      );
      setSavedAlerts((current) => current.filter((entry) => entry.listingId !== idOrSlug));
      return ok(undefined);
    },
    [mySampleListing.id, repository],
  );

  const saveAlert = useCallback(
    async (
      idOrSlug: string,
      alertBelow?: number,
      on = true,
    ): Promise<Result<SavedListingAlert, AppError>> => {
      const target = findListing(idOrSlug);
      const listingKey = target?.id ?? idOrSlug;
      const computedAlertBelow =
        alertBelow !== undefined
          ? Math.max(1, Math.round(alertBelow))
          : (savedAlerts.find((entry) => entry.listingId === listingKey)?.alertBelow ??
            roundTo50((target?.askingPrice ?? 2000) * 0.9));

      const optimistic: SavedListingAlert = {
        listingId: listingKey,
        alertBelow: computedAlertBelow,
        on,
      };
      setSavedAlerts((current) => {
        const exists = current.some((entry) => entry.listingId === listingKey);
        return exists
          ? current.map((entry) => (entry.listingId === listingKey ? optimistic : entry))
          : [...current, optimistic];
      });

      if (repository) {
        const result = await repository.saveListing(idOrSlug, computedAlertBelow, on);
        if (result.ok) {
          await refresh();
        }
        return result;
      }
      return ok(optimistic);
    },
    [findListing, refresh, repository, savedAlerts],
  );

  const removeAlert = useCallback(
    async (idOrSlug: string): Promise<Result<void, AppError>> => {
      const target = findListing(idOrSlug);
      const listingKey = target?.id ?? idOrSlug;
      setSavedAlerts((current) =>
        current.filter((entry) => entry.listingId !== listingKey && entry.listingId !== idOrSlug),
      );
      if (repository) {
        const result = await repository.unsaveListing(idOrSlug);
        if (result.ok) {
          await refresh();
        }
        return result;
      }
      return ok(undefined);
    },
    [findListing, refresh, repository],
  );

  const toggleSaved = useCallback(
    async (idOrSlug: string): Promise<boolean> => {
      const target = findListing(idOrSlug);
      const listingKey = target?.id ?? idOrSlug;
      if (isSaved(listingKey)) {
        await removeAlert(listingKey);
        return false;
      }
      await saveAlert(listingKey);
      return true;
    },
    [findListing, isSaved, removeAlert, saveAlert],
  );

  return useMemo(
    () => ({
      status,
      listings: activeListings,
      previewListings: mappedPreviewListings,
      savedAlerts,
      findListing,
      loadSeller,
      isSaved,
      getAlert,
      refresh,
      publishListing,
      updateListing,
      removeListing,
      toggleSaved,
      saveAlert,
      removeAlert,
    }),
    [
      activeListings,
      findListing,
      getAlert,
      isSaved,
      loadSeller,
      mappedPreviewListings,
      publishListing,
      refresh,
      removeAlert,
      removeListing,
      saveAlert,
      savedAlerts,
      status,
      toggleSaved,
      updateListing,
    ],
  );
}

/** Supplied by the composition root so every Market screen shares the same repository and state. */
export function MarketplaceProvider({
  repository,
  children,
}: {
  readonly repository: MarketplaceRepository;
  readonly children: ReactNode;
}) {
  const state = useMarketplaceStateInternal(repository);
  return (
    <MarketplaceRepositoryContext.Provider value={repository}>
      <MarketplaceStateContext.Provider value={state}>{children}</MarketplaceStateContext.Provider>
    </MarketplaceRepositoryContext.Provider>
  );
}

/**
 * Market state and actions. When rendered outside `MarketplaceProvider` (as in standalone unit
 * tests), falls back to an in-memory state seeded with the preview listings and alerts.
 */
export function useMarketplace(): MarketplaceState {
  const provided = useContext(MarketplaceStateContext);
  const repository = useContext(MarketplaceRepositoryContext);
  const fallback = useMarketplaceStateInternal(provided ? null : repository);
  return provided ?? fallback;
}
