import type { ValidationError } from './errors';
import { err, ok, type Result } from './result';

declare const emailAddressBrand: unique symbol;

export type EmailAddress = string & { readonly [emailAddressBrand]: true };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const parseEmailAddress = (value: string): Result<EmailAddress, ValidationError> => {
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 254 || !emailPattern.test(normalized)) {
    return err({ kind: 'validation', code: 'invalid_email', field: 'email' });
  }

  return ok(normalized as EmailAddress);
};
