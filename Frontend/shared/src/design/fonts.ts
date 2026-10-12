import { tokens } from './tokens';

export type SnapWorthFontFamily = keyof typeof tokens.typography.family;
export type SnapWorthFontWeight = keyof typeof fontFaces;

/**
 * Three voices, each bundled one face per weight (custom fonts cannot synthesise weights reliably
 * on Android or the web):
 *
 * - Plus Jakarta Sans, the friendly workhorse, for reading and controls (`sans`, `rounded`).
 * - Bricolage Grotesque, with its ink traps and a little swagger, for titles and every price
 *   (`display`, `price`): the number is what people come for, so it gets the most character.
 * - DM Mono for what is printed on a tag (`mono`): labels, stamps and small print.
 */
export const fontFaces = {
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
} as const;

export const displayFaces = {
  '400': 'BricolageGrotesque_400Regular',
  '500': 'BricolageGrotesque_500Medium',
  '600': 'BricolageGrotesque_600SemiBold',
  '700': 'BricolageGrotesque_700Bold',
  '800': 'BricolageGrotesque_800ExtraBold',
} as const;

/** The mono comes in two weights; heavier requests take the heavier of them. */
export const monoFaces = {
  '400': 'DMMono_400Regular',
  '500': 'DMMono_500Medium',
} as const;

/** The bundled body face for a weight; unknown weights fall back to regular. */
export function resolveFontFace(weight: string): string {
  return fontFaces[weight as SnapWorthFontWeight] ?? fontFaces['400'];
}

/** The face a typography token renders in, by its family and weight. */
export function resolveFontFamily(family: SnapWorthFontFamily, weight = '400'): string {
  if (family === 'display' || family === 'price') {
    return displayFaces[weight as keyof typeof displayFaces] ?? displayFaces['700'];
  }
  if (family === 'mono') {
    return Number(weight) >= 500 ? monoFaces['500'] : monoFaces['400'];
  }
  return resolveFontFace(weight);
}

export const snapWorthFontContract = Object.freeze({
  displayFamily: tokens.typography.family.display,
  monetaryFamily: tokens.typography.family.price,
  bodyFamily: tokens.typography.family.sans,
  companionFamily: tokens.typography.family.rounded,
  maxFontSizeMultiplier: tokens.typography.maxFontSizeMultiplier,
  allowFontScaling: true,
} as const);
