import { tokens } from './tokens';

export type SnapWorthFontFamily = keyof typeof tokens.typography.family;
export type SnapWorthFontWeight = keyof typeof fontFaces;

/**
 * SnapWorth speaks in one typeface everywhere: Plus Jakarta Sans, a friendly geometric sans in
 * the spirit of the big travel and marketplace apps. It is bundled, one face per weight, because
 * custom fonts cannot synthesise weights reliably on Android or the web. Every semantic family
 * (display, body, the companion's voice) resolves to it; they differ in weight and size only.
 */
export const fontFaces = {
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
} as const;

/** The bundled face for a weight; unknown weights fall back to regular. */
export function resolveFontFace(weight: string): string {
  return fontFaces[weight as SnapWorthFontWeight] ?? fontFaces['400'];
}

/** The face a typography token renders in. Families share one typeface, so only weight matters. */
export function resolveFontFamily(_family: SnapWorthFontFamily, weight = '400'): string {
  return resolveFontFace(weight);
}

export const snapWorthFontContract = Object.freeze({
  displayFamily: tokens.typography.family.display,
  monetaryFamily: tokens.typography.family.sans,
  bodyFamily: tokens.typography.family.sans,
  companionFamily: tokens.typography.family.rounded,
  maxFontSizeMultiplier: tokens.typography.maxFontSizeMultiplier,
  allowFontScaling: true,
} as const);
