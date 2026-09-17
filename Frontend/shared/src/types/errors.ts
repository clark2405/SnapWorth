export type OperationName =
  | 'authenticate'
  | 'reset_password'
  | 'load_profile'
  | 'save_onboarding'
  | 'compress_photo'
  | 'store_item'
  | 'upload_photo'
  | 'estimate_item'
  | 'load_item'
  | 'load_history'
  | 'delete_item'
  | 'publish_feed_post'
  | 'load_feed'
  | 'load_post'
  | 'vote'
  | 'submit_comment'
  | 'delete_comment'
  | 'report_content'
  | 'publish_listing'
  | 'load_marketplace'
  | 'load_listing'
  | 'open_conversation'
  | 'load_conversations'
  | 'load_messages'
  | 'send_message'
  | 'block_user'
  | 'load_moderation_queue'
  | 'resolve_moderation_case';

export type AppError =
  | {
      readonly kind: 'validation';
      readonly code: string;
      readonly field?: string;
      readonly limit?: string;
    }
  | {
      readonly kind: 'authentication';
      readonly code: 'invalid_credentials' | 'email_taken' | 'session_expired';
    }
  | { readonly kind: 'authorization'; readonly code: 'not_found_or_denied' }
  | { readonly kind: 'offline'; readonly operation: OperationName; readonly retryable: true }
  | { readonly kind: 'timeout'; readonly operation: OperationName; readonly retryable: true }
  | {
      readonly kind: 'rate_limited';
      readonly operation: OperationName;
      readonly retryAfterSeconds?: number;
      readonly retryable: true;
    }
  | { readonly kind: 'conflict'; readonly code: string; readonly retryable: boolean }
  | { readonly kind: 'provider'; readonly code: string; readonly retryable: boolean }
  | {
      readonly kind: 'storage';
      readonly stage: 'upload' | 'finalize' | 'delete';
      readonly retryable: boolean;
    }
  | { readonly kind: 'unknown'; readonly requestId: string; readonly retryable: boolean };

export type ValidationError = Extract<AppError, { readonly kind: 'validation' }>;
export type AuthError = Extract<
  AppError,
  { readonly kind: 'authentication' | 'offline' | 'timeout' | 'rate_limited' | 'unknown' }
>;
export type CaptureError = Extract<
  AppError,
  { readonly kind: 'validation' | 'offline' | 'timeout' | 'storage' | 'unknown' }
>;
export type EstimateError = Extract<
  AppError,
  { readonly kind: 'offline' | 'timeout' | 'rate_limited' | 'provider' | 'conflict' | 'unknown' }
>;
export type VoteError = Extract<
  AppError,
  { readonly kind: 'authorization' | 'offline' | 'conflict' | 'unknown' }
>;
export type ModerationError = Extract<
  AppError,
  {
    readonly kind:
      | 'validation'
      | 'authorization'
      | 'offline'
      | 'timeout'
      | 'rate_limited'
      | 'provider'
      | 'conflict'
      | 'unknown';
  }
>;
