import type { ValidationError } from './errors';
import { err, ok, type Result } from './result';

declare const utcDateTimeBrand: unique symbol;

export type UtcDateTime = string & { readonly [utcDateTimeBrand]: true };

const utcIsoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export const parseUtcDateTime = (
  value: string,
  field = 'dateTime',
): Result<UtcDateTime, ValidationError> => {
  if (!utcIsoPattern.test(value)) {
    return err({ kind: 'validation', code: 'invalid_utc_date_time', field });
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return err({ kind: 'validation', code: 'invalid_utc_date_time', field });
  }

  return ok(new Date(timestamp).toISOString() as UtcDateTime);
};

export const utcDateTimeFromDate = (
  value: Date,
  field = 'dateTime',
): Result<UtcDateTime, ValidationError> => {
  if (!Number.isFinite(value.getTime())) {
    return err({ kind: 'validation', code: 'invalid_utc_date_time', field });
  }

  return ok(value.toISOString() as UtcDateTime);
};
