import type { UtcDateTime } from './date-time';
import type { AppError } from './errors';
import type {
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
import { err, ok, type Result } from './result';
import type { ValidationError } from './errors';

declare const commentBodyBrand: unique symbol;
declare const messageBodyBrand: unique symbol;

export type CommentBody = string & { readonly [commentBodyBrand]: true };
export type MessageBody = string & { readonly [messageBodyBrand]: true };

/** The most a comment can say; the database enforces the same limit. */
export const commentBodyMaxLength = 280;

/** A comment body is its trimmed text, 1 to 280 characters. */
export const parseCommentBody = (raw: string): Result<CommentBody, ValidationError> => {
  const body = raw.trim();
  if (body.length === 0) return err({ kind: 'validation', code: 'empty', field: 'comment' });
  if (body.length > commentBodyMaxLength) {
    return err({
      kind: 'validation',
      code: 'too_long',
      field: 'comment',
      limit: String(commentBodyMaxLength),
    });
  }
  return ok(body as CommentBody);
};

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
  'timeout' | 'rate_limited' | 'provider_unavailable' | 'invalid_response' | 'offline' | 'unknown';

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

/** The public face of an account, as shown beside what it posts. */
export interface PublicProfile {
  readonly userId: UserId;
  readonly handle: string;
  readonly avatarUrl?: string;
}

/** A comment as one viewer sees it in a post's thread. */
export interface ThreadComment {
  readonly id: CommentId;
  /** The top-level comment this replies to. Threads are one level deep. */
  readonly parentId: CommentId | null;
  /** The parent exists but this viewer can no longer see it (deleted or held for review). */
  readonly parentHidden: boolean;
  readonly body: CommentBody;
  /** Others only ever see `approved`; an author also sees their own pending or held comment. */
  readonly moderationStatus: ModerationStatus;
  readonly createdAt: UtcDateTime;
  readonly author: PublicProfile;
  readonly isMine: boolean;
  readonly reportedByMe: boolean;
}

/** What posting a comment produced, after moderation has had its say. */
export interface CommentReceipt {
  readonly comment: ThreadComment;
}

export type PublicContentRef =
  | { readonly type: 'feed_post'; readonly id: PostId }
  | { readonly type: 'comment'; readonly id: CommentId }
  | { readonly type: 'listing'; readonly id: ListingId };

export type ReportReason = 'spam' | 'harassment' | 'prohibited_item' | 'misleading' | 'other';

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

/** The most a chat message can say; the database enforces the same limit. */
export const messageBodyMaxLength = 1000;

/** A chat message's text is trimmed, 1 to 1,000 characters. */
export const parseMessageBody = (raw: string): Result<MessageBody, ValidationError> => {
  const body = raw.trim();
  if (body.length === 0) return err({ kind: 'validation', code: 'empty', field: 'message' });
  if (body.length > messageBodyMaxLength) {
    return err({
      kind: 'validation',
      code: 'too_long',
      field: 'message',
      limit: String(messageBodyMaxLength),
    });
  }
  return ok(body as MessageBody);
};

/** `countered` means a newer offer, from either side, replaced this one. */
export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'countered';
export type MeetupStatus = 'proposed' | 'confirmed';
/** A pickup hands the item over; a viewing is for seeing it in person before deciding. */
export type MeetupPurpose = 'pickup' | 'viewing';

export interface ChatOffer {
  readonly amountPhp: number;
  readonly status: OfferStatus;
}

/** Where on the map a meetup is pinned. */
export interface MeetupLocation {
  readonly lat: number;
  readonly lng: number;
}

/**
 * A proposed pickup or viewing: where and when, and whether the other side has agreed.
 * `location` is the pin the two people agree on; `spotKey` is set when it is one of the suggested
 * public places, whose name and pin then come from the server's list.
 */
export interface ChatMeetup {
  readonly place: string;
  readonly when: string;
  readonly status: MeetupStatus;
  readonly purpose: MeetupPurpose;
  readonly location?: MeetupLocation;
  readonly spotKey?: string;
}

/**
 * One message in a conversation: plain text, a price offer (with an optional note in `body`),
 * or a proposed pickup. Its id is chosen by the sender's device, so a resend never doubles it.
 */
export interface Message {
  readonly id: MessageId;
  readonly conversationId: ConversationId;
  readonly senderId: UserId;
  readonly mine: boolean;
  readonly body: string;
  readonly offer?: ChatOffer;
  readonly meetup?: ChatMeetup;
  readonly createdAt: UtcDateTime;
  readonly delivery: MessageDeliveryState;
}

/** What a new message says, before it has an id or a sender. */
export type OutgoingMessage =
  | { readonly kind: 'text'; readonly body: MessageBody }
  | { readonly kind: 'offer'; readonly amountPhp: number; readonly note?: MessageBody }
  | {
      readonly kind: 'meetup';
      readonly purpose: MeetupPurpose;
      /** One of the suggested public places; it decides the place's name and pin. */
      readonly spotKey?: string;
      /** Anywhere else, pinned on the map. */
      readonly location?: MeetupLocation;
      readonly place: string;
      readonly when: string;
    };

/** The listing a conversation is about, as the conversation shows it. */
export interface ChatListing {
  /** The listing's public key, the same one its link uses. */
  readonly key: string;
  readonly title: string;
  readonly askingPricePhp: number;
  readonly photoUrl?: string;
}

/** The latest message, as much as a list row needs to describe it. */
export interface ConversationPreview {
  readonly fromMe: boolean;
  readonly body: string;
  readonly offerPhp?: number;
  readonly meetupPlace?: string;
  readonly meetupPurpose?: MeetupPurpose;
}

export type ChatReportReason = 'scam' | 'harassment' | 'spam' | 'other';

export interface ConversationSummary {
  readonly id: ConversationId;
  readonly listing: ChatListing;
  readonly other: PublicProfile;
  readonly iAmSeller: boolean;
  readonly latest?: ConversationPreview;
  readonly latestActivityAt: UtcDateTime;
  /** Messages from the other person the viewer hasn't read. */
  readonly unread: number;
  /** Set once the conversation is over: it lists under Past and can't be replied to. */
  readonly closed?: 'sold' | 'archived';
  readonly blockedByMe: boolean;
}

export interface ConversationDetail extends ConversationSummary {
  /** Oldest first. */
  readonly messages: readonly Message[];
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
