import type { UtcDateTime } from './date-time';
import type { AppError } from './errors';
import type {
  ClientMessageId,
  CommentId,
  ConversationId,
  ItemId,
  ListingId,
  MessageId,
  ModerationCaseId,
  PostId,
  ReportId,
  UserId,
} from './ids';
import type { EmailAddress } from './identity';
import type { AiEstimate, AskingPrice } from './money';

declare const commentBodyBrand: unique symbol;
declare const messageBodyBrand: unique symbol;

export type CommentBody = string & { readonly [commentBodyBrand]: true };
export type MessageBody = string & { readonly [messageBodyBrand]: true };

export type UserRole = 'user' | 'owner' | 'administrator';

export interface Credentials {
  readonly email: EmailAddress;
  readonly password: string;
}

export interface Session {
  readonly userId: UserId;
  readonly email: EmailAddress;
  readonly role: UserRole;
  readonly expiresAt: UtcDateTime;
}

export interface Profile {
  readonly userId: UserId;
  readonly displayName: string;
  readonly onboardingCompletedAt?: UtcDateTime;
}

export type Category =
  | 'antiques'
  | 'art'
  | 'collectibles'
  | 'electronics'
  | 'fashion'
  | 'furniture'
  | 'home'
  | 'jewelry'
  | 'other'
  | 'sports'
  | 'toys';

export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface SelectedImage {
  readonly uri: string;
  readonly name: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
  readonly lastModifiedAt?: UtcDateTime;
}

export interface PhotoRef {
  readonly path: string;
  readonly version: string;
  readonly alternativeText: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType: ImageMimeType;
}

export type EstimateFailureCode =
  | 'timeout'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'invalid_response'
  | 'offline'
  | 'unknown';

export type EstimationState =
  | { readonly status: 'estimating'; readonly attempt: number; readonly startedAt: UtcDateTime }
  | {
      readonly status: 'estimated';
      readonly attempt: number;
      readonly estimate: AiEstimate;
      readonly completedAt: UtcDateTime;
    }
  | {
      readonly status: 'failed';
      readonly attempt: number;
      readonly code: EstimateFailureCode;
      readonly retryable: boolean;
    }
  | { readonly status: 'queued_offline'; readonly attempt: number };

export interface StoredItem {
  readonly id: ItemId;
  readonly ownerId: UserId;
  readonly photo: PhotoRef;
  readonly title?: string;
  readonly category?: Category;
  readonly estimation: EstimationState;
  readonly createdAt: UtcDateTime;
  readonly updatedAt: UtcDateTime;
}

export type ModerationStatus = 'pending' | 'approved' | 'held' | 'removed';
export type VoteChoice = 'too_high' | 'too_low' | 'just_right';
export type VoteCounts = Readonly<Record<VoteChoice, number>>;

export interface FeedPost {
  readonly id: PostId;
  readonly itemId: ItemId;
  readonly ownerId: UserId;
  readonly photo: PhotoRef;
  readonly estimate: AiEstimate;
  readonly title?: string;
  readonly moderationStatus: ModerationStatus;
  readonly publicationStatus: 'published' | 'withdrawn';
  readonly voteCounts: VoteCounts;
  readonly publishedAt?: UtcDateTime;
  readonly deletedAt?: UtcDateTime;
}

export interface Comment {
  readonly id: CommentId;
  readonly postId: PostId;
  readonly authorId: UserId;
  readonly body: CommentBody;
  readonly moderationStatus: ModerationStatus;
  readonly createdAt: UtcDateTime;
  readonly deletedAt?: UtcDateTime;
}

export interface FeedPostDetail {
  readonly post: FeedPost;
  readonly comments: readonly Comment[];
  readonly viewerVote: VoteChoice | null;
}

export interface VoteSnapshot {
  readonly choice: VoteChoice | null;
  readonly counts: VoteCounts;
}

export type CommentReceipt =
  | { readonly status: 'approved'; readonly comment: Comment }
  | { readonly status: 'held'; readonly commentId: CommentId };

export type PublicContentRef =
  | { readonly type: 'feed_post'; readonly id: PostId }
  | { readonly type: 'comment'; readonly id: CommentId }
  | { readonly type: 'listing'; readonly id: ListingId };

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'prohibited_item'
  | 'misleading'
  | 'other';

export interface ModerationReport {
  readonly id: ReportId;
  readonly target: PublicContentRef;
  readonly reporterId: UserId;
  readonly reason: ReportReason;
  readonly createdAt: UtcDateTime;
}

export type ListingStatus = 'held' | 'active' | 'sold' | 'withdrawn';

export interface Listing {
  readonly id: ListingId;
  readonly itemId: ItemId;
  readonly sellerId: UserId;
  readonly photo: PhotoRef;
  readonly estimate?: AiEstimate;
  readonly askingPrice: AskingPrice;
  readonly category: Category;
  readonly regionCode?: string;
  readonly moderationStatus: ModerationStatus;
  readonly status: ListingStatus;
  readonly publishedAt?: UtcDateTime;
}

export interface ListingDetail {
  readonly listing: Listing;
  readonly sellerDisplayName: string;
  readonly isViewerSeller: boolean;
}

export interface MarketFilter {
  readonly category?: Category;
  readonly minimumPriceCents?: number;
  readonly maximumPriceCents?: number;
  readonly regionCode?: string;
}

export interface AskingPriceDraftInput {
  readonly rawInput: string;
  readonly locale: string;
}

export type MessageDeliveryState =
  | { readonly status: 'pending' }
  | { readonly status: 'delivered'; readonly deliveredAt: UtcDateTime }
  | { readonly status: 'failed'; readonly error: AppError; readonly retryable: boolean };

export interface Message {
  readonly id?: MessageId;
  readonly clientId: ClientMessageId;
  readonly conversationId: ConversationId;
  readonly senderId: UserId;
  readonly body: MessageBody;
  readonly delivery: MessageDeliveryState;
  readonly createdAt: UtcDateTime;
}

export interface ConversationSummary {
  readonly id: ConversationId;
  readonly listingId: ListingId;
  readonly otherParticipantId: UserId;
  readonly listingPhoto: PhotoRef;
  readonly latestMessage?: Message;
  readonly latestActivityAt: UtcDateTime;
}

export interface ConversationDetail {
  readonly id: ConversationId;
  readonly listingId: ListingId;
  readonly buyerId: UserId;
  readonly sellerId: UserId;
  readonly messages: readonly Message[];
  readonly blocked: boolean;
}

export type ModerationTargetType = 'feed_post' | 'comment' | 'listing';
export type ModerationDecision = 'approve' | 'remove';

export interface ModerationCase {
  readonly id: ModerationCaseId;
  readonly target: PublicContentRef;
  readonly priority: number;
  readonly status: 'unresolved' | 'resolved';
  readonly version: number;
  readonly submittedAt: UtcDateTime;
  readonly decision?: ModerationDecision;
  readonly decidedAt?: UtcDateTime;
}
