import type { ImageSourcePropType } from 'react-native';

import type {
  MarketArea,
  MarketCategory,
  MarketListing,
  SellerProfile,
} from '../../ports/marketplace';
import type { UtcDateTime } from '../../types/date-time';
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
  previewSellers,
  previewUsers,
  type PreviewUser,
} from '../preview/sample-data';

// The Market's sample content, for the app running alone on a device (no Supabase project): the
// local marketplace repository starts from it. With a project, none of this is read.

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

/**
 * The bundled photo of a sample listing. Only a sample listing has one (its `rowId` starts with
 * `seed-`), so a real listing without a photo gets a placeholder, never a stranger's photo.
 */
export function sampleListingPhoto(
  listing: Pick<MarketListing, 'id' | 'slug' | 'rowId'>,
): ImageSourcePropType | null {
  if (!listing.rowId.startsWith('seed-')) return null;
  return (
    previewPhotoByListingKey[listing.slug] ??
    previewPhotoByListingKey[listing.id] ??
    previewListingDetail.photo
  );
}

/** The bundled avatar of a sample seller (their id starts with `preview:`), else none. */
export function sampleSellerAvatar(seller: {
  readonly id?: string;
  readonly handle: string;
}): ImageSourcePropType | null {
  if (!seller.id?.startsWith('preview:')) return null;
  return previewAvatarByHandle[seller.handle] ?? previewUsers.mariaCruz.avatar;
}

/** Builds the preview owner's own sample listing (`nike-neon-windbreaker`). */
export function buildPreviewMyMarketListing(): MarketListing {
  return {
    id: previewMyListing.id,
    rowId: 'seed-listing-mine',
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
    moderationStatus: 'approved',
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
      moderationStatus: 'approved',
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
