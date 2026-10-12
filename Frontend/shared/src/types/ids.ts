import { err, ok, type Result } from './result';
import type { ValidationError } from './errors';

declare const entityIdBrand: unique symbol;
declare const idempotencyKeyBrand: unique symbol;

export type EntityIdKind =
  | 'user'
  | 'item'
  | 'post'
  | 'comment'
  | 'listing'
  | 'conversation'
  | 'message'
  | 'clientMessage'
  | 'moderationCase'
  | 'report';

type BrandedId<K extends EntityIdKind> = string & {
  readonly [entityIdBrand]: K;
};

export type UserId = BrandedId<'user'>;
export type ItemId = BrandedId<'item'>;
export type PostId = BrandedId<'post'>;
export type CommentId = BrandedId<'comment'>;
export type ListingId = BrandedId<'listing'>;
export type ConversationId = BrandedId<'conversation'>;
export type MessageId = BrandedId<'message'>;
export type ClientMessageId = BrandedId<'clientMessage'>;
export type ModerationCaseId = BrandedId<'moderationCase'>;
export type ReportId = BrandedId<'report'>;

export interface EntityIdByKind {
  readonly user: UserId;
  readonly item: ItemId;
  readonly post: PostId;
  readonly comment: CommentId;
  readonly listing: ListingId;
  readonly conversation: ConversationId;
  readonly message: MessageId;
  readonly clientMessage: ClientMessageId;
  readonly moderationCase: ModerationCaseId;
  readonly report: ReportId;
}

export type EntityId = EntityIdByKind[EntityIdKind];
export type IdempotencyKey = string & { readonly [idempotencyKeyBrand]: true };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const opaqueKeyPattern = /^[A-Za-z0-9_-]{16,128}$/;

export const parseEntityId = <K extends EntityIdKind>(
  kind: K,
  value: string,
): Result<EntityIdByKind[K], ValidationError> => {
  const normalized = value.trim().toLowerCase();
  if (!uuidPattern.test(normalized)) {
    return err({ kind: 'validation', code: 'invalid_id', field: `${kind}Id` });
  }

  return ok(normalized as EntityIdByKind[K]);
};

export const parseIdempotencyKey = (value: string): Result<IdempotencyKey, ValidationError> => {
  const normalized = value.trim();
  if (!opaqueKeyPattern.test(normalized)) {
    return err({
      kind: 'validation',
      code: 'invalid_idempotency_key',
      field: 'idempotencyKey',
      limit: '16-128 URL-safe characters',
    });
  }

  return ok(normalized as IdempotencyKey);
};
