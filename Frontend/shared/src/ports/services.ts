import type { AppError, AuthError, CaptureError, EstimateError, ModerationError, ValidationError, VoteError } from '../types/errors';
import type {
  CommentBody,
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
  MessageBody,
  ModerationCase,
  ModerationStatus,
  Profile,
  PublicContentRef,
  ReportReason,
  Session,
  StoredItem,
  VoteChoice,
  VoteSnapshot,
  SelectedImage,
} from '../types/entities';
import type {
  ClientMessageId,
  CommentId,
  ConversationId,
  IdempotencyKey,
  ItemId,
  ListingId,
  ModerationCaseId,
  PostId,
  ReportId,
  UserId,
} from '../types/ids';
import type { AiEstimate, AskingPriceDraft } from '../types/money';
import type { Cursor, Page } from '../types/pagination';
import type { Result } from '../types/result';
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

export interface CommentService {
  submit(postId: PostId, body: CommentBody): Promise<Result<CommentReceipt, ModerationError>>;
  remove(commentId: CommentId): Promise<Result<void, AppError>>;
  report(target: PublicContentRef, reason: ReportReason): Promise<Result<ReportId, AppError>>;
}

export interface ListingService {
  parsePrice(raw: string, locale?: string): Result<AskingPriceDraft, ValidationError>;
  publish(itemId: ItemId, confirmed: AskingPriceDraft): Promise<Result<Listing, ModerationError>>;
  browse(filter: MarketFilter, cursor?: Cursor): Promise<Result<Page<Listing>, AppError>>;
  get(listingId: ListingId): Promise<Result<ListingDetail, AppError>>;
}

export type MessageListener = (message: Message) => void;

export interface ChatService {
  openOrReuse(listingId: ListingId): Promise<Result<ConversationId, AppError>>;
  listConversations(): Promise<Result<readonly ConversationSummary[], AppError>>;
  getAuthorized(id: ConversationId): Promise<Result<ConversationDetail, AppError>>;
  send(
    id: ConversationId,
    body: MessageBody,
    clientId: ClientMessageId,
  ): Promise<Result<Message, AppError>>;
  subscribe(id: ConversationId, listener: MessageListener): Unsubscribe;
  block(userId: UserId): Promise<Result<void, AppError>>;
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
  estimate(request: EstimateRequest, signal?: AbortSignal): Promise<Result<AiEstimate, EstimateError>>;
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
