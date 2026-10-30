import type {
  AppError,
  AuthError,
  CaptureError,
  EstimateError,
  ModerationError,
  ValidationError,
  VoteError,
} from '../types/errors';
import type {
  CommentReceipt,
  ConversationDetail,
  ConversationSummary,
  Credentials,
  FeedPost,
  FeedPostDetail,
  Listing,
  ListingDetail,
  MarketFilter,
  Message,
  MeetupLocation,
  MeetupPurpose,
  ChatReportReason,
  OfferStatus,
  ModerationCase,
  ModerationStatus,
  Profile,
  PublicContentRef,
  ReportReason,
  Session,
  StoredItem,
  ThreadComment,
  VoteChoice,
  VoteSnapshot,
  SelectedImage,
} from '../types/entities';
import type {
  CommentId,
  ConversationId,
  IdempotencyKey,
  MessageId,
  ItemId,
  ListingId,
  ModerationCaseId,
  PostId,
  UserId,
} from '../types/ids';
import type { AiEstimate, AskingPriceDraft } from '../types/money';
import type { Cursor, Page } from '../types/pagination';
import type { Result } from '../types/result';
import type { ChatListener } from './chat';
import type { Unsubscribe } from './platform';

export interface AuthService {
  observeSession(listener: (session: Session | null) => void): Unsubscribe;
  signUp(credentials: Credentials): Promise<Result<Session, AuthError>>;
  signIn(credentials: Credentials): Promise<Result<Session, AuthError>>;
  signOut(): Promise<Result<void, AppError>>;
  resetPassword(email: Credentials['email']): Promise<Result<void, AuthError>>;
}

export interface ProfileService {
  getOwnProfile(): Promise<Result<Profile, AppError>>;
  completeOnboarding(): Promise<Result<Profile, AppError>>;
}

export interface ItemService {
  capture(input: SelectedImage, signal?: AbortSignal): Promise<Result<StoredItem, CaptureError>>;
  retryEstimate(itemId: ItemId, signal?: AbortSignal): Promise<Result<StoredItem, EstimateError>>;
  getOwnedItem(itemId: ItemId): Promise<Result<StoredItem, AppError>>;
  listHistory(cursor?: Cursor): Promise<Result<Page<StoredItem>, AppError>>;
  deleteOwnedItem(itemId: ItemId): Promise<Result<void, AppError>>;
}

export interface FeedService {
  publish(itemId: ItemId): Promise<Result<FeedPost, ModerationError>>;
  list(cursor?: Cursor): Promise<Result<Page<FeedPost>, AppError>>;
  get(postId: PostId): Promise<Result<FeedPostDetail, AppError>>;
  unpublish(postId: PostId): Promise<Result<void, AppError>>;
}

export interface VoteService {
  setVote(postId: PostId, desired: VoteChoice | null): Promise<Result<VoteSnapshot, VoteError>>;
}

/**
 * A post's discussion. Posts are addressed by their public key (the slug in a post's link).
 * Submitting returns the comment as moderation left it: `approved` and public, or `pending` /
 * `held` and visible only to its author.
 */
export interface CommentService {
  listThread(postKey: string): Promise<Result<readonly ThreadComment[], AppError>>;
  submit(
    postKey: string,
    body: string,
    replyTo?: CommentId,
  ): Promise<Result<CommentReceipt, ModerationError>>;
  remove(commentId: CommentId): Promise<Result<void, AppError>>;
  report(target: CommentId, reason: ReportReason): Promise<Result<void, AppError>>;
}

export interface ListingService {
  parsePrice(raw: string, locale?: string): Result<AskingPriceDraft, ValidationError>;
  publish(itemId: ItemId, confirmed: AskingPriceDraft): Promise<Result<Listing, ModerationError>>;
  browse(filter: MarketFilter, cursor?: Cursor): Promise<Result<Page<Listing>, AppError>>;
  get(listingId: ListingId): Promise<Result<ListingDetail, AppError>>;
}

/**
 * The viewer's chats with buyers and sellers. Every send validates its input first and is
 * stored under an id chosen here, so a failed send can be retried without doubling.
 */
export interface ChatService {
  start(listingKey: string): Promise<Result<ConversationId, AppError>>;
  list(): Promise<Result<readonly ConversationSummary[], AppError>>;
  get(id: ConversationId): Promise<Result<ConversationDetail, AppError>>;
  /** A fresh id for a message about to be sent; pass it to `send` again to retry. */
  nextMessageId(): MessageId;
  sendText(id: MessageId, conversationId: ConversationId, body: string): Promise<SendResult>;
  sendOffer(
    id: MessageId,
    conversationId: ConversationId,
    amountPhp: number,
    note?: string,
  ): Promise<SendResult>;
  proposeMeetup(
    id: MessageId,
    conversationId: ConversationId,
    meetup: MeetupProposal,
  ): Promise<SendResult>;
  respondToOffer(messageId: MessageId, accept: boolean): Promise<Result<OfferStatus, AppError>>;
  confirmMeetup(messageId: MessageId): Promise<Result<void, AppError>>;
  markRead(id: ConversationId): Promise<Result<void, AppError>>;
  report(id: ConversationId, reason: ChatReportReason): Promise<Result<void, AppError>>;
  setBlocked(userId: UserId, blocked: boolean): Promise<Result<void, AppError>>;
  subscribe(listener: ChatListener): Unsubscribe;
}

export type SendResult = Result<Message, AppError>;

/**
 * Where and when to meet, and why. `location` is wherever the proposer dropped the pin, and
 * `place` what they called it. With `spotKey` the pin is one of the suggested public places, and
 * its name and pin come from that place instead.
 */
export interface MeetupProposal {
  readonly purpose: MeetupPurpose;
  readonly spotKey?: string;
  readonly location?: MeetupLocation;
  readonly place?: string;
  readonly when: string;
}

export interface AdminReviewService {
  listQueue(cursor?: Cursor): Promise<Result<Page<ModerationCase>, AppError>>;
  resolve(
    caseId: ModerationCaseId,
    decision: 'approve' | 'remove',
    expectedVersion: number,
  ): Promise<Result<ModerationCase, AppError>>;
}

export interface EstimateRequest {
  readonly itemId: ItemId;
  readonly attempt: number;
  readonly idempotencyKey: IdempotencyKey;
}

export interface PricingService {
  estimate(
    request: EstimateRequest,
    signal?: AbortSignal,
  ): Promise<Result<AiEstimate, EstimateError>>;
}

export interface ModerationRequest {
  readonly target: PublicContentRef;
  readonly idempotencyKey: IdempotencyKey;
}

export interface ModerationVerdict {
  readonly status: Extract<ModerationStatus, 'approved' | 'held'>;
  readonly providerRef?: string;
}

export interface ModerationService {
  screen(
    request: ModerationRequest,
    signal?: AbortSignal,
  ): Promise<Result<ModerationVerdict, ModerationError>>;
}

export interface CrossPostService {
  feedToMarketplace(
    postId: PostId,
    askingPrice: AskingPriceDraft,
  ): Promise<Result<Listing, ModerationError>>;
  marketplaceToFeed(listingId: ListingId): Promise<Result<FeedPost, ModerationError>>;
}
