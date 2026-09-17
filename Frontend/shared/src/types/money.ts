import type { UtcDateTime } from './date-time';
import type { ValidationError } from './errors';
import type { UserId } from './ids';
import { err, ok, type Result } from './result';

declare const minorUnitsBrand: unique symbol;
declare const priceMeaningBrand: unique symbol;

export type CurrencyCode = 'USD';
export type MinorUnits = number & { readonly [minorUnitsBrand]: 'USD' };
export type AiEstimateAmount = MinorUnits & {
  readonly [priceMeaningBrand]: 'ai_estimate';
};
export type AskingPriceAmount = MinorUnits & {
  readonly [priceMeaningBrand]: 'asking_price';
};

export interface AiEstimateConfidence {
  readonly lower: AiEstimateAmount;
  readonly upper: AiEstimateAmount;
}

export interface AiEstimate {
  readonly amount: AiEstimateAmount;
  readonly currency: CurrencyCode;
  readonly confidence?: AiEstimateConfidence;
  readonly providerRef: string;
}

export interface AskingPriceDraft {
  readonly amount: AskingPriceAmount;
  readonly currency: CurrencyCode;
  readonly rawInput: string;
}

export interface AskingPrice {
  readonly amount: AskingPriceAmount;
  readonly currency: CurrencyCode;
  readonly confirmedBy: UserId;
  readonly confirmedAt: UtcDateTime;
}

export interface NormalizedEstimateInput {
  readonly amountCents: number;
  readonly providerRef: string;
  readonly confidence?: { readonly lowerCents: number; readonly upperCents: number };
}

export const MAX_ASKING_PRICE_CENTS = 99_999_999_999;

const isValidCents = (value: number, allowZero: boolean, maximum = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(value) && value <= maximum && (allowZero ? value >= 0 : value > 0);

export const normalizeAiEstimate = (
  input: NormalizedEstimateInput,
): Result<AiEstimate, ValidationError> => {
  if (!isValidCents(input.amountCents, true)) {
    return err({ kind: 'validation', code: 'invalid_ai_estimate', field: 'amountCents' });
  }
  if (input.providerRef.trim().length === 0) {
    return err({ kind: 'validation', code: 'invalid_provider_reference', field: 'providerRef' });
  }

  const amount = input.amountCents as AiEstimateAmount;
  if (input.confidence === undefined) {
    return ok({ amount, currency: 'USD', providerRef: input.providerRef });
  }

  const { lowerCents, upperCents } = input.confidence;
  if (
    !isValidCents(lowerCents, true) ||
    !isValidCents(upperCents, true) ||
    lowerCents > input.amountCents ||
    upperCents < input.amountCents
  ) {
    return err({
      kind: 'validation',
      code: 'invalid_estimate_confidence',
      field: 'confidence',
    });
  }

  return ok({
    amount,
    currency: 'USD',
    confidence: {
      lower: lowerCents as AiEstimateAmount,
      upper: upperCents as AiEstimateAmount,
    },
    providerRef: input.providerRef,
  });
};

export const createAskingPriceDraft = (
  rawInput: string,
  amountCents: number,
): Result<AskingPriceDraft, ValidationError> => {
  if (rawInput.trim().length === 0) {
    return err({ kind: 'validation', code: 'empty_asking_price', field: 'askingPrice' });
  }
  if (!isValidCents(amountCents, false, MAX_ASKING_PRICE_CENTS)) {
    return err({
      kind: 'validation',
      code: 'invalid_asking_price',
      field: 'askingPrice',
      limit: 'USD 0.01 through USD 999,999,999.99',
    });
  }

  return ok({
    amount: amountCents as AskingPriceAmount,
    currency: 'USD',
    rawInput,
  });
};

export const confirmAskingPrice = (
  draft: AskingPriceDraft,
  confirmedBy: UserId,
  confirmedAt: UtcDateTime,
): AskingPrice => ({
  amount: draft.amount,
  currency: draft.currency,
  confirmedBy,
  confirmedAt,
});

type Assert<T extends true> = T;
export type PriceMeaningsAreDistinct = Assert<
  [AiEstimateAmount] extends [AskingPriceAmount] ? false : true
>;
export type ReversePriceMeaningsAreDistinct = Assert<
  [AskingPriceAmount] extends [AiEstimateAmount] ? false : true
>;
