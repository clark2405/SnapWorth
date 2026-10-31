/**
 * The photo coach: which shots buyers and the AI need to judge a kind of item. The kind comes
 * from the iPhone's own item reader where it has Apple Intelligence (`ItemReader.swift` reads it
 * as one of these). Everywhere else nothing works it out yet, so the coach gives general tips:
 * that needs the cloud AI, which isn't built yet (see `agents/READ-FIRST.md`).
 */

export type ItemKind =
  'clothing' | 'shoes' | 'bags' | 'electronics' | 'collectibles' | 'home' | 'other';

export interface PhotoCoach {
  readonly title: string;
  readonly shots: readonly string[];
}

/** For any item, or when the kind isn't known. */
export const generalPhotoTips: PhotoCoach = {
  title: 'For a better estimate',
  shots: [
    'Fit the whole item in the frame, in daylight',
    'A shot of the brand tag tightens the range',
    'Show any wear — honest photos sell faster',
  ],
};

const coachByKind: Readonly<Record<Exclude<ItemKind, 'other'>, PhotoCoach>> = {
  clothing: {
    title: 'For clothes, also snap',
    shots: [
      'The neck tag, with the brand and size',
      'The care label',
      'Any stains, pilling or holes',
    ],
  },
  shoes: {
    title: 'For shoes, also snap',
    shots: [
      'The size tag inside the tongue',
      'The soles, for wear',
      'The box label, if you have it',
    ],
  },
  bags: {
    title: 'For bags, also snap',
    shots: [
      'The logo and the metal parts, up close',
      'Inside: the lining, and any date code or serial',
      'The corners and handles, for wear',
    ],
  },
  electronics: {
    title: 'For electronics, also snap',
    shots: [
      'The label with the model and serial number',
      'It switched on and working',
      'The screen and ports, for scratches',
    ],
  },
  collectibles: {
    title: 'For collectibles, also snap',
    shots: [
      'Any marks, stamps or signatures',
      'The box or packaging',
      'The edges and corners, up close',
    ],
  },
  home: {
    title: 'For home things, also snap',
    shots: [
      'Any maker’s mark underneath',
      'Chips, cracks or scratches, up close',
      'Something beside it, to show the size',
    ],
  },
};

/** The shots for a kind of item, or the general tips when the kind isn't one we know. */
export function coachFor(kind: string | null | undefined): PhotoCoach {
  if (kind && Object.hasOwn(coachByKind, kind))
    return coachByKind[kind as keyof typeof coachByKind];
  return generalPhotoTips;
}
