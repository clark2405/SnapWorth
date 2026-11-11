import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ListingStatus,
  MarketArea,
  MarketCategory,
  MarketCondition,
  MarketListing,
  MarketplaceRepository,
  SavedListingAlert,
} from '../../ports/marketplace';
import type { UtcDateTime } from '../../types/date-time';
import type { ModerationStatus, VoteChoice } from '../../types/entities';
import { err, ok } from '../../types/result';
import { toAppError } from './errors';
import { createSupabaseScanPhotos, type ScanPhotoStore } from './photo-storage';
import { ensureSignedIn } from './session';

interface ProfileJoin {
  readonly id: string;
  readonly handle: string;
  readonly display_name?: string | null;
  readonly avatar_url?: string | null;
  readonly bio?: string | null;
  readonly location?: string | null;
  readonly created_at?: string | null;
}

interface ListingRow {
  readonly id: string;
  readonly slug: string;
  readonly seller_id: string;
  readonly scan_id: string | null;
  readonly title: string;
  readonly asking_php: number;
  readonly photo_url: string | null;
  readonly photo_path: string | null;
  readonly category: MarketCategory;
  readonly condition: MarketCondition;
  readonly area: MarketArea;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly description: string;
  readonly estimate_php: number | null;
  readonly estimate_low_php: number | null;
  readonly estimate_high_php: number | null;
  readonly verdict: VoteChoice | null;
  readonly verdict_share: number | null;
  readonly views_count: number;
  readonly saves_count: number;
  readonly status: ListingStatus;
  readonly moderation_status: ModerationStatus;
  readonly created_at: string;
  readonly seller: ProfileJoin | readonly ProfileJoin[] | null;
}

interface SavedListingRow {
  readonly listing_id: string;
  readonly alert_below_php: number;
  readonly alert_enabled: boolean;
  readonly listing: { readonly slug: string } | readonly { readonly slug: string }[] | null;
}

const listingColumns = [
  'id',
  'slug',
  'seller_id',
  'scan_id',
  'title',
  'asking_php',
  'photo_url',
  'photo_path',
  'category',
  'condition',
  'area',
  'lat',
  'lng',
  'description',
  'estimate_php',
  'estimate_low_php',
  'estimate_high_php',
  'verdict',
  'verdict_share',
  'views_count',
  'saves_count',
  'status',
  'moderation_status',
  'created_at',
  'seller:profiles(id, handle, display_name, avatar_url, bio, location, created_at)',
].join(', ');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roundTo50 = (value: number) => Math.max(50, Math.round(value / 50) * 50);

function formatJoined(isoDate?: string | null): string {
  if (!isoDate) return 'Joined 2026';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Joined 2026';
  const month = date.toLocaleString('en-US', { month: 'long' });
  return `Joined ${month} ${date.getFullYear()}`;
}

function unwrapSeller(seller: ListingRow['seller']): ProfileJoin | null {
  if (!seller) return null;
  return (Array.isArray(seller) ? seller[0] : seller) ?? null;
}

function toMarketListing(
  row: ListingRow,
  viewerId: string | null,
  signedUrls: Readonly<Record<string, string>>,
  chatsCount = 0,
): MarketListing {
  const seller = unwrapSeller(row.seller);
  const handle = seller?.handle ?? 'seller';
  const displayName =
    seller?.display_name && seller.display_name.trim().length > 0 ? seller.display_name : handle;
  const signedPhoto = row.photo_path ? signedUrls[row.photo_path] : undefined;

  return {
    id: row.slug,
    rowId: row.id,
    slug: row.slug,
    scanId: row.scan_id,
    title: row.title,
    askingPrice: row.asking_php,
    photoUrl: signedPhoto ?? row.photo_url ?? null,
    photoPath: row.photo_path,
    photoLabel: row.title,
    category: row.category,
    condition: row.condition,
    area: row.area,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    description: row.description ?? '',
    estimatePhp: row.estimate_php,
    estimateLowPhp: row.estimate_low_php,
    estimateHighPhp: row.estimate_high_php,
    verdict: row.verdict ?? null,
    verdictShare: row.verdict_share ?? null,
    status: row.status,
    moderationStatus: row.moderation_status ?? 'pending',
    seller: {
      id: row.seller_id,
      handle,
      displayName,
      avatarUrl: seller?.avatar_url ?? null,
      rating: '4.9',
      sales: 12,
    },
    stats: {
      views: row.views_count ?? 0,
      saves: row.saves_count ?? 0,
      chats: chatsCount,
    },
    createdAt: row.created_at as UtcDateTime,
    mine: viewerId !== null && row.seller_id === viewerId,
  };
}

export function createSupabaseMarketplaceRepository(
  client: SupabaseClient,
  photos: ScanPhotoStore = createSupabaseScanPhotos(client),
): MarketplaceRepository {
  async function viewerId(): Promise<string | null> {
    const { data } = await client.auth.getSession();
    return data.session?.user.id ?? null;
  }

  async function signRows(rows: readonly ListingRow[]): Promise<Readonly<Record<string, string>>> {
    const paths = rows.flatMap((row) => (row.photo_path ? [row.photo_path] : []));
    return paths.length > 0 ? photos.links(paths) : {};
  }

  /**
   * Screens a listing that is waiting for moderation (a new one, or one whose title or
   * description just changed) and returns the row as it stands after. A screening that can't be
   * reached leaves the listing pending, hidden from everyone but its seller; it is screened the
   * next time it is published or edited.
   */
  async function screened(row: ListingRow): Promise<ListingRow> {
    if (row.moderation_status !== 'pending') return row;
    const { data } = await client.functions
      .invoke<{ status?: ModerationStatus }>('moderate-content', {
        body: { type: 'listing', id: row.id },
      })
      .catch(() => ({ data: null }));
    return data?.status ? { ...row, moderation_status: data.status } : row;
  }

  async function findRow(idOrSlug: string): Promise<ListingRow | null> {
    const column = uuidPattern.test(idOrSlug) ? 'id' : 'slug';
    const { data, error } = await client
      .from('listings')
      .select(listingColumns)
      .eq(column, idOrSlug)
      .neq('status', 'removed')
      .maybeSingle();
    if (error || !data) return null;
    return data as unknown as ListingRow;
  }

  return {
    async list() {
      const [{ data, error }, viewer] = await Promise.all([
        client
          .from('listings')
          .select(listingColumns)
          .neq('status', 'removed')
          .order('created_at', { ascending: false })
          .limit(100),
        viewerId(),
      ]);
      if (error) return err(toAppError(error, 'load_marketplace', 'listing'));
      const rows = (data ?? []) as unknown as ListingRow[];
      const signed = await signRows(rows);
      return ok(rows.map((row) => toMarketListing(row, viewer, signed)));
    },

    async findById(idOrSlug) {
      const [row, viewer] = await Promise.all([findRow(idOrSlug), viewerId()]);
      if (!row) return ok(null);
      const signed = await signRows([row]);
      let chatsCount = 0;
      if (viewer && row.seller_id === viewer) {
        const { count } = await client
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('listing_id', row.id);
        chatsCount = count ?? 0;
      }
      return ok(toMarketListing(row, viewer, signed, chatsCount));
    },

    async sellerByHandle(handle) {
      const normalized = handle.trim().toLowerCase().replace(/^@/, '');
      const { data: profileData, error: profileError } = await client
        .from('profiles')
        .select('id, handle, display_name, avatar_url, bio, location, created_at')
        .eq('handle', normalized)
        .maybeSingle();
      if (profileError) return err(toAppError(profileError, 'load_profile', 'profile'));
      if (!profileData) return ok(null);

      const profile = profileData as unknown as ProfileJoin;
      const [{ data: listingData, error: listingError }, { count: soldCount }, viewer] =
        await Promise.all([
          client
            .from('listings')
            .select(listingColumns)
            .eq('seller_id', profile.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false }),
          client
            .from('listings')
            .select('id', { count: 'exact', head: true })
            .eq('seller_id', profile.id)
            .eq('status', 'sold'),
          viewerId(),
        ]);
      if (listingError) return err(toAppError(listingError, 'load_marketplace', 'listing'));

      const rows = (listingData ?? []) as unknown as ListingRow[];
      const signed = await signRows(rows);
      const sales = soldCount ?? 0;
      const listings = rows.map((row) => ({
        ...toMarketListing(row, viewer, signed),
        seller: {
          id: profile.id,
          handle: profile.handle,
          displayName:
            profile.display_name && profile.display_name.trim().length > 0
              ? profile.display_name
              : profile.handle,
          avatarUrl: profile.avatar_url ?? null,
          rating: '4.9',
          sales,
        },
      }));

      return ok({
        id: profile.id,
        handle: profile.handle,
        displayName:
          profile.display_name && profile.display_name.trim().length > 0
            ? profile.display_name
            : profile.handle,
        avatarUrl: profile.avatar_url ?? null,
        rating: '4.9',
        sales,
        joined: formatJoined(profile.created_at),
        bio: profile.bio ?? '',
        location: profile.location ?? '',
        listings,
      });
    },

    async publish(input) {
      const signedIn = await ensureSignedIn(client);
      if (!signedIn.ok) return err(signedIn.error);

      const { data, error } = await client
        .from('listings')
        .insert({
          scan_id: input.scanId ?? null,
          title: input.title,
          asking_php: Math.round(input.askingPrice),
          photo_path: input.scanId ? (input.photoPath ?? null) : null,
          category: input.category,
          condition: input.condition,
          area: input.area,
          description: input.description,
        })
        .select(listingColumns)
        .single();
      if (error) return err(toAppError(error, 'publish_listing', 'listing'));

      if (input.scanId) {
        await client
          .from('scan_history')
          .update({ status: 'listed' })
          .eq('id', input.scanId)
          .then(
            () => undefined,
            () => undefined,
          );
      }

      const row = await screened(data as unknown as ListingRow);
      const signed = await signRows([row]);
      return ok(toMarketListing(row, signedIn.value, signed));
    },

    async update(idOrSlug, change) {
      const signedIn = await ensureSignedIn(client);
      if (!signedIn.ok) return err(signedIn.error);

      const target = await findRow(idOrSlug);
      if (!target || target.seller_id !== signedIn.value) {
        return err({ kind: 'authorization', code: 'not_found_or_denied' });
      }

      const patch: Record<string, unknown> = {};
      if (change.title !== undefined) patch.title = change.title;
      if (change.askingPrice !== undefined) patch.asking_php = Math.round(change.askingPrice);
      if (change.category !== undefined) patch.category = change.category;
      if (change.condition !== undefined) patch.condition = change.condition;
      if (change.area !== undefined) patch.area = change.area;
      if (change.description !== undefined) patch.description = change.description;
      if (change.status !== undefined) patch.status = change.status;

      const { data, error } = await client
        .from('listings')
        .update(patch)
        .eq('id', target.id)
        .select(listingColumns)
        .single();
      if (error) return err(toAppError(error, 'publish_listing', 'listing'));

      if (change.status && target.scan_id) {
        const nextScanStatus =
          change.status === 'sold' ? 'sold' : change.status === 'removed' ? 'private' : 'listed';
        await client
          .from('scan_history')
          .update({ status: nextScanStatus })
          .eq('id', target.scan_id)
          .then(
            () => undefined,
            () => undefined,
          );
      }

      // New words go back to moderation (the database sets the listing to pending); screen them.
      const row = await screened(data as unknown as ListingRow);
      const signed = await signRows([row]);
      return ok(toMarketListing(row, signedIn.value, signed));
    },

    async remove(idOrSlug) {
      const signedIn = await ensureSignedIn(client);
      if (!signedIn.ok) return err(signedIn.error);

      const target = await findRow(idOrSlug);
      if (!target || target.seller_id !== signedIn.value) {
        return err({ kind: 'authorization', code: 'not_found_or_denied' });
      }

      const { data, error } = await client
        .from('listings')
        .update({ status: 'removed' })
        .eq('id', target.id)
        .select('id');
      if (error) return err(toAppError(error, 'publish_listing', 'listing'));
      if (!data?.length) return err({ kind: 'authorization', code: 'not_found_or_denied' });

      if (target.scan_id) {
        await client
          .from('scan_history')
          .update({ status: 'private' })
          .eq('id', target.scan_id)
          .then(
            () => undefined,
            () => undefined,
          );
      }
      return ok(undefined);
    },

    async listSaved() {
      const viewer = await viewerId();
      if (!viewer) return ok([]);
      const { data, error } = await client
        .from('saved_listings')
        .select('listing_id, alert_below_php, alert_enabled, listing:listings(slug)')
        .eq('user_id', viewer)
        .order('created_at', { ascending: false });
      if (error) return err(toAppError(error, 'load_marketplace', 'listing'));
      const rows = (data ?? []) as unknown as SavedListingRow[];
      const alerts: SavedListingAlert[] = rows.flatMap((row) => {
        const joined = Array.isArray(row.listing) ? row.listing[0] : row.listing;
        const slug = joined?.slug;
        if (!slug) return [];
        return [
          {
            listingId: slug,
            alertBelow: row.alert_below_php,
            on: row.alert_enabled,
          },
        ];
      });
      return ok(alerts);
    },

    async saveListing(idOrSlug, alertBelow, on = true) {
      const signedIn = await ensureSignedIn(client);
      if (!signedIn.ok) return err(signedIn.error);

      const target = await findRow(idOrSlug);
      if (!target) return err({ kind: 'authorization', code: 'not_found_or_denied' });

      const targetAlertBelow =
        alertBelow !== undefined
          ? Math.max(1, Math.round(alertBelow))
          : roundTo50(target.asking_php * 0.9);

      const { error } = await client.from('saved_listings').upsert(
        {
          listing_id: target.id,
          alert_below_php: targetAlertBelow,
          alert_enabled: on,
        },
        { onConflict: 'user_id,listing_id' },
      );
      if (error) return err(toAppError(error, 'load_marketplace', 'listing'));

      return ok({
        listingId: target.slug,
        alertBelow: targetAlertBelow,
        on,
      });
    },

    async unsaveListing(idOrSlug) {
      const signedIn = await ensureSignedIn(client);
      if (!signedIn.ok) return err(signedIn.error);

      const target = await findRow(idOrSlug);
      if (!target) return ok(undefined);

      const { error } = await client
        .from('saved_listings')
        .delete()
        .eq('user_id', signedIn.value)
        .eq('listing_id', target.id);
      if (error) return err(toAppError(error, 'load_marketplace', 'listing'));
      return ok(undefined);
    },
  };
}
