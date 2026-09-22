import type { AppError } from './errors';
import type {
  CommentBody,
  MessageBody,
  SelectedImage,
  StoredItem,
  VoteChoice,
  VoteSnapshot,
} from './entities';
import type { AskingPriceDraft } from './money';
import type { ClientMessageId } from './ids';

export type CaptureState =
  | { readonly status: 'idle' }
  | { readonly status: 'selected'; readonly photo: SelectedImage }
  | { readonly status: 'compressing'; readonly photo: SelectedImage }
  | { readonly status: 'persisting'; readonly photo: SelectedImage }
  | { readonly status: 'estimating'; readonly item: StoredItem }
  | { readonly status: 'estimated'; readonly item: StoredItem }
  | { readonly status: 'estimate_failed'; readonly item: StoredItem; readonly error: AppError }
  | { readonly status: 'queued_offline'; readonly item: StoredItem };

export type VoteState =
  | { readonly status: 'confirmed'; readonly snapshot: VoteSnapshot; readonly error?: AppError }
  | {
      readonly status: 'pending';
      readonly confirmed: VoteSnapshot;
      readonly desired: VoteChoice | null;
    };

export type PublicSubmissionState<T> =
  | { readonly status: 'draft' }
  | { readonly status: 'submitting' }
  | { readonly status: 'held'; readonly value: T }
  | { readonly status: 'approved'; readonly value: T }
  | { readonly status: 'error'; readonly error: AppError };

export type ListingFormState<T> =
  | { readonly status: 'empty'; readonly rawInput: '' }
  | { readonly status: 'editing_invalid'; readonly rawInput: string; readonly error: AppError }
  | {
      readonly status: 'editing_valid';
      readonly rawInput: string;
      readonly draft: AskingPriceDraft;
    }
  | { readonly status: 'publishing'; readonly rawInput: string; readonly draft: AskingPriceDraft }
  | { readonly status: 'held'; readonly listing: T }
  | { readonly status: 'active'; readonly listing: T }
  | {
      readonly status: 'error';
      readonly rawInput: string;
      readonly draft?: AskingPriceDraft;
      readonly error: AppError;
    };

export type MessageComposerState =
  | { readonly status: 'draft'; readonly body: MessageBody }
  | { readonly status: 'pending'; readonly body: MessageBody; readonly clientId: ClientMessageId }
  | { readonly status: 'delivered'; readonly body: MessageBody; readonly clientId: ClientMessageId }
  | {
      readonly status: 'failed';
      readonly body: MessageBody;
      readonly clientId: ClientMessageId;
      readonly error: AppError;
    };

export interface RecoverableDrafts {
  readonly photo?: SelectedImage;
  readonly askingPrice?: string;
  readonly comment?: CommentBody;
  readonly message?: MessageBody;
}
