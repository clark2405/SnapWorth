import type {
  ChatReportReason,
  ConversationDetail,
  ConversationSummary,
  Message,
  OfferStatus,
  OutgoingMessage,
} from '../types/entities';
import type { AppError } from '../types/errors';
import type { ConversationId, MessageId, UserId } from '../types/ids';
import type { Result } from '../types/result';
import type { Unsubscribe } from './platform';

/**
 * Something that changed in the viewer's chats while they were looking: a new message, or an
 * offer or pickup that was answered (the message arrives again, whole), or the other person
 * starting or stopping typing.
 */
export type ChatEvent =
  | { readonly type: 'message'; readonly message: Message }
  | {
      readonly type: 'typing';
      readonly conversationId: ConversationId;
      readonly typing: boolean;
    };

export type ChatListener = (event: ChatEvent) => void;

/**
 * Storage for the viewer's chats. Implementations decide who the viewer is and enforce what
 * they may see and do; the Supabase one leaves that to row-level security and the database's
 * own functions.
 */
export interface ChatRepository {
  /** Opens the viewer's conversation about a listing, or returns the one they already have. */
  start(listingKey: string): Promise<Result<ConversationId, AppError>>;
  list(): Promise<Result<readonly ConversationSummary[], AppError>>;
  get(id: ConversationId): Promise<Result<ConversationDetail, AppError>>;
  /** Stores a message under the id the device chose. Sending the same id again is harmless. */
  send(
    id: MessageId,
    conversationId: ConversationId,
    message: OutgoingMessage,
  ): Promise<Result<Message, AppError>>;
  respondToOffer(messageId: MessageId, accept: boolean): Promise<Result<OfferStatus, AppError>>;
  confirmMeetup(messageId: MessageId): Promise<Result<void, AppError>>;
  markRead(id: ConversationId): Promise<Result<void, AppError>>;
  report(id: ConversationId, reason: ChatReportReason): Promise<Result<void, AppError>>;
  setBlocked(userId: UserId, blocked: boolean): Promise<Result<void, AppError>>;
  /** Changes across all of the viewer's conversations, as they happen. */
  subscribe(listener: ChatListener): Unsubscribe;
}
