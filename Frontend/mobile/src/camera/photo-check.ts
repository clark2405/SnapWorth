import type { PhotoClues } from '@snapworth/shared/types';

import type { ItemImpression, PhotoMeasurement } from '../snap-sense';

export type PhotoProblem = 'dark' | 'blurry' | 'no_item';

/**
 * Where a photo stops being worth pricing. Measured on sample photos: real ones ranged from
 * 0.17 to 0.80 bright and 450 to 1600 sharp, while a dark one read 0.06 and a blurred one 3.
 * The limits sit well below the real photos, so a good photo is never turned away; tune them
 * on phones, not on these numbers alone.
 */
export const photoLimits = {
  darkBelow: 0.1,
  blurryBelow: 40,
} as const;

/** What's wrong with a photo, worst first, or null when it's worth sending. */
export function photoProblem(measurement: PhotoMeasurement): PhotoProblem | null {
  if (measurement.brightness < photoLimits.darkBelow) return 'dark';
  if (measurement.sharpness < photoLimits.blurryBelow) return 'blurry';
  // No subject alone isn't enough (a close-up can fill the frame): only with nothing printed.
  const printed = measurement.text.length > 0 || measurement.codes.length > 0;
  if (measurement.looked && measurement.subject === null && !printed) return 'no_item';
  return null;
}

export const photoProblemCopy: Record<PhotoProblem, { title: string; body: string }> = {
  dark: {
    title: 'Too dark to price',
    body: 'Turn on the flash or find more light, then retake it.',
  },
  blurry: {
    title: 'A little blurry',
    body: 'Hold the phone still until it focuses, then retake it.',
  },
  no_item: {
    title: 'Can’t find an item',
    body: 'Fill the frame with the item you want priced, then retake it.',
  },
};

/** The on-device model's brand, only when the same name is printed in the photo. */
export function confirmedBrand(impression: ItemImpression, text: readonly string[]): string | null {
  const brand = impression.brand.trim();
  if (!brand) return null;
  const printed = text.join(' ').toLowerCase();
  return printed.includes(brand.toLowerCase()) ? brand : null;
}

/** What the phone read, for the cloud. Undefined when it read nothing. */
export function cluesFrom(
  measurement: PhotoMeasurement | null,
  impression: ItemImpression | null,
): PhotoClues | undefined {
  const text = measurement?.text ?? [];
  const codes = measurement?.codes ?? [];
  // The model's brand is left out: when it's printed it's already in the text, and when it
  // isn't it's a guess the cloud would be steered by.
  const looksLike =
    impression && impression.item.trim()
      ? { item: impression.item, category: impression.category, colours: impression.colours }
      : undefined;
  if (text.length === 0 && codes.length === 0 && !looksLike) return undefined;
  return looksLike ? { text, codes, looksLike } : { text, codes };
}
