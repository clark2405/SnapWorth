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

/** A random (version 4) UUID, for ids a device picks itself so a retried write never doubles. */
export function newUuid(): string {
  const bytes = new Uint8Array(16);
  const crypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => void } }).crypto;
  if (crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
