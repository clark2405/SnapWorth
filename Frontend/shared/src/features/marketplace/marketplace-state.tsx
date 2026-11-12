import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ImageSourcePropType } from 'react-native';

import type { AccountObserver } from '../../ports/account';
import type {
  MarketListing,
  MarketplaceRepository,
  NewListingInput,
  SavedListingAlert,
  SellerProfile,
  UpdateListingInput,
} from '../../ports/marketplace';
import type { UtcDateTime } from '../../types/date-time';
import type { AppError } from '../../types/errors';
import { err, ok, type Result } from '../../types/result';
import {
  previewPriceAlerts,
  previewSellers,
  previewUsers,
  type PreviewListing,
} from '../preview/sample-data';
import {
  buildPreviewMarketListings,
  buildPreviewMyMarketListing,
  buildPreviewSellerSeeds,
  sampleListingPhoto,
  sampleSellerAvatar,
} from './marketplace-seed';

export type MarketplaceLoadStatus = 'loading' | 'ready' | 'failed';

/**
 * A listing's photo: its own (uploaded or on this device), the bundled photo of a sample listing,
 * or null when it has none, so the screen shows a placeholder rather than somebody else's photo.
 */
export function listingPhotoSource(
  listing: Pick<MarketListing, 'id' | 'slug' | 'rowId' | 'photoUrl'>,
): ImageSourcePropType | null {
  if (listing.photoUrl && listing.photoUrl.trim().length > 0) {
    return { uri: listing.photoUrl };
  }
  return sampleListingPhoto(listing);
}

/** A seller's avatar: their uploaded photo, a sample seller's bundled one, or null (their initial). */
export function sellerAvatarSource(seller: {
  readonly id?: string;
  readonly handle: string;
  readonly avatarUrl?: string | null;
}): ImageSourcePropType | null {
  if (seller.avatarUrl && seller.avatarUrl.trim().length > 0) {
    return { uri: seller.avatarUrl };
  }
  return sampleSellerAvatar(seller);
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

export interface MarketplaceState {
  readonly status: MarketplaceLoadStatus;
  /** Active listings anyone can see (approved by moderation), newest first: Market's. */
  readonly listings: readonly MarketListing[];
  /** The viewer's own active listings, including those still waiting for or held by moderation. */
  readonly myListings: readonly MarketListing[];
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
  /** Saves or unsaves a listing; on success, whether it is saved now. A failure is undone. */
  readonly toggleSaved: (idOrSlug: string) => Promise<Result<boolean, AppError>>;
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

/** What to tell someone whose save or price alert didn't go through. It is put back as it was. */
export const savedNotKept = {
  title: 'Couldn’t save that',
  body: 'Your saved listings are as they were. Check your connection and try again.',
} as const;

/**
 * With a repository, the Market is whatever it holds (Supabase's listings, or the device
 * repository's sample ones), and starts empty until it has loaded. Without one (a standalone
 * screen in a unit test) it's an in-memory copy of the sample listings.
 */
function useMarketplaceStateInternal(
  repository: MarketplaceRepository | null,
  account?: AccountObserver,
): MarketplaceState {
  const [status, setStatus] = useState<MarketplaceLoadStatus>(repository ? 'loading' : 'ready');
  const [allListings, setAllListings] = useState<readonly MarketListing[]>(() =>
    repository ? [] : buildPreviewMarketListings(),
  );
  const [mySampleListing, setMySampleListing] = useState<MarketListing>(() =>
    buildPreviewMyMarketListing(),
  );
  const [savedAlerts, setSavedAlerts] = useState<readonly SavedListingAlert[]>(() =>
    repository ? [] : previewPriceAlerts.map((entry) => ({ ...entry })),
  );

  // Whose Market: the signed-in account, nobody (null), or not known yet (undefined).
  const [owner, setOwner] = useState<string | null | undefined>(account ? undefined : null);
  /** Moves on with each load, so a slower, older load is thrown away. */
  const loadGeneration = useRef(0);
  /** Moves on with each account change, so a change in flight for the last person is ignored. */
  const accountEpoch = useRef(0);
  const lastOwner = useRef<string | null | undefined>(undefined);

  useEffect(() => (account ? account.observe(setOwner) : undefined), [account]);

  const refresh = useCallback(async () => {
    if (!repository) {
      setStatus('ready');
      return;
    }
    const mine = ++loadGeneration.current;
    // A retry after a failure shows loading again; a refresh of a Market already on screen
    // doesn't blank it.
    setStatus((current) => (current === 'ready' ? 'ready' : 'loading'));
    const [listingsResult, savedResult] = await Promise.all([
      repository.list(),
      repository.listSaved(),
    ]);
    if (mine !== loadGeneration.current) return;
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
    // Wait until we know who is signed in, so the first load is the right person's.
    if (owner === undefined) return;
    if (lastOwner.current !== undefined && lastOwner.current !== owner) {
      // A different person (or none): the last one's saved alerts, own listings and "mine"
      // flags go at once, and any load or change still on its way for them is dropped.
      accountEpoch.current += 1;
      loadGeneration.current += 1;
      setAllListings([]);
      setSavedAlerts([]);
      setStatus(repository ? 'loading' : 'ready');
    }
    lastOwner.current = owner;
    void refresh();
  }, [owner, refresh, repository]);

  // Public: approved and active. The seller's own waiting or held listings stay out of the
  // Market (the database hides them from everyone else too) but are in `myListings`.
  const activeListings = useMemo(
    () =>
      allListings.filter(
        (listing) => listing.status === 'active' && listing.moderationStatus === 'approved',
      ),
    [allListings],
  );
  const myListings = useMemo(
    () => allListings.filter((listing) => listing.status === 'active' && listing.mine),
    [allListings],
  );

  const mappedPreviewListings = useMemo(
    () => activeListings.map(toPreviewListing),
    [activeListings],
  );

  const findListing = useCallback(
    (idOrSlug: string | undefined): MarketListing | null => {
      // With a repository, a listing that isn't there isn't there: no sample stands in for it.
      if (!idOrSlug) return repository ? null : (activeListings[0] ?? null);
      const inList = allListings.find(
        (entry) =>
          (entry.id === idOrSlug || entry.slug === idOrSlug || entry.rowId === idOrSlug) &&
          entry.status !== 'removed',
      );
      if (inList || repository) return inList ?? null;
      if (idOrSlug === mySampleListing.id && mySampleListing.status !== 'removed') {
        return mySampleListing;
      }
      return (
        buildPreviewMarketListings().find((entry) => entry.id === idOrSlug) ??
        activeListings[0] ??
        null
      );
    },
    [activeListings, allListings, mySampleListing, repository],
  );

  const loadSeller = useCallback(
    async (handle: string): Promise<SellerProfile | null> => {
      const normalized = handle.trim().toLowerCase().replace(/^@/, '');
      if (repository) {
        const result = await repository.sellerByHandle(normalized);
        return result.ok ? result.value : null;
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
        const epoch = accountEpoch.current;
        const result = await repository.publish(input);
        if (result.ok && epoch === accountEpoch.current) {
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
        moderationStatus: 'approved',
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
        const epoch = accountEpoch.current;
        const result = await repository.update(idOrSlug, change);
        if (result.ok && epoch === accountEpoch.current) {
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
        const epoch = accountEpoch.current;
        const result = await repository.remove(idOrSlug);
        if (result.ok && epoch === accountEpoch.current) {
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

      const previous = savedAlerts.find((entry) => entry.listingId === listingKey);
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
        const epoch = accountEpoch.current;
        const result = await repository.saveListing(idOrSlug, computedAlertBelow, on);
        // Someone else signed in meanwhile: what is on screen is theirs now.
        if (epoch !== accountEpoch.current) return result;
        if (!result.ok) {
          // Put back what was there: the earlier alert, or nothing.
          setSavedAlerts((current) =>
            previous
              ? current.map((entry) => (entry.listingId === listingKey ? previous : entry))
              : current.filter((entry) => entry.listingId !== listingKey),
          );
          return result;
        }
        await refresh();
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
      const previous = savedAlerts.find(
        (entry) => entry.listingId === listingKey || entry.listingId === idOrSlug,
      );
      setSavedAlerts((current) =>
        current.filter((entry) => entry.listingId !== listingKey && entry.listingId !== idOrSlug),
      );
      if (repository) {
        const epoch = accountEpoch.current;
        const result = await repository.unsaveListing(idOrSlug);
        if (epoch !== accountEpoch.current) return result;
        if (!result.ok) {
          // It's still saved: bring it back.
          if (previous) {
            setSavedAlerts((current) =>
              current.some((entry) => entry.listingId === previous.listingId)
                ? current
                : [...current, previous],
            );
          }
          return result;
        }
        await refresh();
        return result;
      }
      return ok(undefined);
    },
    [findListing, refresh, repository, savedAlerts],
  );

  const toggleSaved = useCallback(
    async (idOrSlug: string): Promise<Result<boolean, AppError>> => {
      const target = findListing(idOrSlug);
      const listingKey = target?.id ?? idOrSlug;
      if (isSaved(listingKey)) {
        const removed = await removeAlert(listingKey);
        return removed.ok ? ok(false) : err(removed.error);
      }
      const saved = await saveAlert(listingKey);
      return saved.ok ? ok(true) : err(saved.error);
    },
    [findListing, isSaved, removeAlert, saveAlert],
  );

  return useMemo(
    () => ({
      status,
      listings: activeListings,
      myListings,
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
      myListings,
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
  account,
  children,
}: {
  readonly repository: MarketplaceRepository;
  /**
   * Who is signed in. The Market follows them: on every sign-in, sign-out or switch it drops the
   * last person's saved alerts, own listings and "mine" flags at once and loads again. This
   * provider sits above the session, so it can't ask the session; without this it loads once.
   */
  readonly account?: AccountObserver;
  readonly children: ReactNode;
}) {
  const state = useMarketplaceStateInternal(repository, account);
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
