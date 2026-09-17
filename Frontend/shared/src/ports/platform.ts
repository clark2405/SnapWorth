import type { UtcDateTime } from '../types/date-time';
import type { EntityIdByKind, EntityIdKind, IdempotencyKey } from '../types/ids';

export type Unsubscribe = () => void;

export interface Clock {
  now(): UtcDateTime;
}

export interface IdGenerator {
  generate<K extends EntityIdKind>(kind: K): EntityIdByKind[K];
  generateIdempotencyKey(): IdempotencyKey;
}

export type NetworkStatus =
  | { readonly status: 'online' }
  | { readonly status: 'offline' }
  | { readonly status: 'unknown' };

export interface NetworkPort {
  getStatus(): NetworkStatus;
  subscribe(listener: (status: NetworkStatus) => void): Unsubscribe;
}
