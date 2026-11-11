import type { UtcDateTime } from '../types/date-time';
import type { VoteChoice } from '../types/entities';
import type { AppError } from '../types/errors';
import type { Result } from '../types/result';

export type MarketCategory = 'collectibles' | 'fashion' | 'sneakers' | 'electronics' | 'home';
export type MarketCondition = 'new' | 'like_new' | 'good' | 'fair';
export type MarketArea = 'cebu-city' | 'mandaue' | 'lapu-lapu' | 'metro-manila';
export type ListingStatus = 'active' | 'sold' | 'removed';

export interface ListingSellerSummary {
  readonly id: string;
  readonly handle: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly rating: string;
  readonly sales: number;
}

export interface MarketListing {
  /** The stable public key (`slug`) used in links and `start_conversation`. */
  readonly id: string;
  /** Database UUID (`listings.id`). */
  readonly rowId: string;
  readonly slug: string;
  readonly scanId: string | null;
  readonly title: string;
  readonly askingPrice: number;
  readonly photoUrl: string | null;
  readonly photoPath: string | null;
  readonly photoLabel: string;
  readonly category: MarketCategory;
  readonly condition: MarketCondition;
  readonly area: MarketArea;
  /**
   * Where the listing is, rounded to about 1 km by the database (null: use the area's centre).
   * Distance from a viewer is worked out on their device; it is not stored.
   */
  readonly lat: number | null;
  readonly lng: number | null;
  readonly description: string;
  readonly estimatePhp: number | null;
  readonly estimateLowPhp: number | null;
  readonly estimateHighPhp: number | null;
  /** What most voters say of the asking price, and their share. Null until someone has voted. */
  readonly verdict: VoteChoice | null;
  readonly verdictShare: number | null;
  readonly status: ListingStatus;
  readonly seller: ListingSellerSummary;
  readonly stats: {
    readonly views: number;
    readonly saves: number;
    readonly chats: number;
  };
  readonly createdAt: UtcDateTime;
  readonly mine: boolean;
}

export interface SellerProfile {
  readonly id: string;
  readonly handle: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly rating: string;
  readonly sales: number;
  readonly joined: string;
  readonly bio: string;
  readonly location: string;
  readonly listings: readonly MarketListing[];
}

export interface SavedListingAlert {
  /** Matches `MarketListing.id` (`slug`). */
  readonly listingId: string;
  readonly alertBelow: number;
  readonly on: boolean;
}

export interface NewListingInput {
  readonly scanId?: string | null;
  readonly title: string;
  readonly askingPrice: number;
  readonly photoUrl?: string | null;
  readonly photoPath?: string | null;
  readonly category: MarketCategory;
  readonly condition: MarketCondition;
  readonly area: MarketArea;
  readonly description: string;
  /**
   * Only the on-device adapter uses the three estimate fields. Supabase ignores them: the database
   * copies the estimate and range from the linked scan, so a seller can't claim an AI value.
   */
  readonly estimatePhp?: number | null;
  readonly estimateLowPhp?: number | null;
  readonly estimateHighPhp?: number | null;
}

export interface UpdateListingInput {
  readonly title?: string;
  readonly askingPrice?: number;
  readonly category?: MarketCategory;
  readonly condition?: MarketCondition;
  readonly area?: MarketArea;
  readonly description?: string;
  readonly status?: ListingStatus;
}

export interface MarketplaceRepository {
  /** All active listings and all of the viewer's own listings, newest first. */
  list(): Promise<Result<readonly MarketListing[], AppError>>;
  /** Finds a listing by its public `slug` or its database `rowId`. */
  findById(idOrSlug: string): Promise<Result<MarketListing | null, AppError>>;
  /** Loads a seller's public profile and their active listings by handle. */
  sellerByHandle(handle: string): Promise<Result<SellerProfile | null, AppError>>;
  /** Publishes a new active listing for the signed-in seller. */
  publish(input: NewListingInput): Promise<Result<MarketListing, AppError>>;
  /** Updates the seller's own listing (price, details, or status). */
  update(idOrSlug: string, change: UpdateListingInput): Promise<Result<MarketListing, AppError>>;
  /** Deletes the seller's own listing. */
  remove(idOrSlug: string): Promise<Result<void, AppError>>;
  /** All saved listings and price-drop alerts for the signed-in buyer. */
  listSaved(): Promise<Result<readonly SavedListingAlert[], AppError>>;
  /** Saves a listing (or updates its price-drop alert target and toggle). */
  saveListing(
    idOrSlug: string,
    alertBelow?: number,
    on?: boolean,
  ): Promise<Result<SavedListingAlert, AppError>>;
  /** Removes a listing from the buyer's saved list. */
  unsaveListing(idOrSlug: string): Promise<Result<void, AppError>>;
}
