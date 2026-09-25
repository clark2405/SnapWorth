import { tokens } from './tokens';

export type SnapWorthFontFamily = keyof typeof tokens.typography.family;
export type FontPlatform = 'ios' | 'android' | 'web' | (string & {});

/**
 * SnapWorth ships no bundled faces: it speaks in the platform's own type. On Apple platforms
 * that is SF Pro, with New York as the editorial serif and SF Rounded for the companion.
 * Android falls back to Roboto and its serif; the web uses the same system stacks.
 */
const platformFamilies: Record<
  SnapWorthFontFamily,
  { ios?: string; android?: string; web: string }
> = {
  sans: { web: tokens.typography.webFamily.sans },
  serif: { ios: 'ui-serif', android: 'serif', web: tokens.typography.webFamily.serif },
  rounded: { ios: 'ui-rounded', web: tokens.typography.webFamily.rounded },
};

/** `undefined` means "the platform default", which is the system face everywhere but web. */
export function resolveFontFamily(
  family: SnapWorthFontFamily,
  platform: FontPlatform,
): string | undefined {
  const entry = platformFamilies[family];
  if (platform === 'web') return entry.web;
  if (platform === 'ios' || platform === 'macos') return entry.ios;
  return entry.android;
}

export const snapWorthFontContract = Object.freeze({
  displayFamily: tokens.typography.family.serif,
  monetaryFamily: tokens.typography.family.sans,
  bodyFamily: tokens.typography.family.sans,
  companionFamily: tokens.typography.family.rounded,
  maxFontSizeMultiplier: tokens.typography.maxFontSizeMultiplier,
  allowFontScaling: true,
} as const);
