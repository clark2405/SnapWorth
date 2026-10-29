export interface CapturedItemImage {
  readonly data: string;
  readonly mimeType: 'image/jpeg';
}

interface EstimateDetails {
  readonly itemName: string;
  readonly explanation: string;
  readonly assumptions: readonly string[];
}
export type PhotoEstimate =
  | (EstimateDetails & {
      readonly status: 'estimated';
      readonly amountPhp: number;
      readonly lowPhp: number;
      readonly highPhp: number;
    })
  | (EstimateDetails & {
      readonly status: 'unable_to_estimate';
      readonly amountPhp: null;
      readonly lowPhp: null;
      readonly highPhp: null;
    });

/**
 * What the phone read in the photo before sending it, passed to the cloud as hints. Text and
 * codes are exactly as printed (a size tag, a model number); `looksLike` is the on-device
 * model's first impression, which may be wrong. The cloud still prices from the photo itself.
 */
export interface PhotoClues {
  readonly text: readonly string[];
  readonly codes: readonly string[];
  readonly looksLike?: {
    readonly item: string;
    readonly category: string;
    readonly colours: readonly string[];
  };
}

export interface PhotoPricingService {
  estimate(
    image: CapturedItemImage,
    signal?: AbortSignal,
    clues?: PhotoClues,
  ): Promise<PhotoEstimate>;
}

export function isPhotoEstimate(value: unknown): value is PhotoEstimate {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  if (
    typeof data.itemName !== 'string' ||
    typeof data.explanation !== 'string' ||
    !data.explanation.trim() ||
    !Array.isArray(data.assumptions) ||
    !data.assumptions.every((entry) => typeof entry === 'string')
  )
    return false;
  if (data.status === 'unable_to_estimate')
    return data.amountPhp === null && data.lowPhp === null && data.highPhp === null;
  if (data.status !== 'estimated' || !data.itemName.trim()) return false;
  if (
    ![data.amountPhp, data.lowPhp, data.highPhp].every(
      (amount) =>
        typeof amount === 'number' &&
        Number.isFinite(amount) &&
        amount >= 0 &&
        amount <= 1_000_000_000,
    )
  )
    return false;
  return (
    Number(data.lowPhp) <= Number(data.amountPhp) && Number(data.amountPhp) <= Number(data.highPhp)
  );
}
