import type { ValidationError } from './errors';
import { err, ok, type Result } from './result';

declare const cursorBrand: unique symbol;

export type Cursor = string & { readonly [cursorBrand]: true };

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor?: Cursor;
}

export interface PageRequest {
  readonly cursor?: Cursor;
  readonly limit?: number;
}

const cursorPattern = /^[A-Za-z0-9_-]{1,512}$/;

export const parseCursor = (value: string): Result<Cursor, ValidationError> => {
  const normalized = value.trim();
  if (!cursorPattern.test(normalized)) {
    return err({
      kind: 'validation',
      code: 'invalid_cursor',
      field: 'cursor',
      limit: '512 URL-safe characters',
    });
  }

  return ok(normalized as Cursor);
};
