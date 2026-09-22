import { tokens } from './tokens';

export const snapWorthFontFaces = Object.freeze([
  tokens.typography.family.displayExtraBold,
  tokens.typography.family.displayBold,
  tokens.typography.family.displaySemibold,
  tokens.typography.family.bodyRegular,
  tokens.typography.family.bodyMedium,
  tokens.typography.family.bodySemibold,
] as const);

export type SnapWorthFontFace = (typeof snapWorthFontFaces)[number];
export type FontAsset = number | string | Readonly<{ uri: string }>;
export type SnapWorthFontAssets = Readonly<Record<SnapWorthFontFace, FontAsset>>;

export interface FontLoader {
  loadAsync(assets: SnapWorthFontAssets): Promise<void>;
}

export type FontLoadState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready' }
  | { readonly status: 'error'; readonly cause: unknown };

export interface SnapWorthFontContract {
  readonly requiredFaces: readonly SnapWorthFontFace[];
  readonly displayFamily: SnapWorthFontFace;
  readonly monetaryFamily: SnapWorthFontFace;
  readonly bodyFamily: SnapWorthFontFace;
  readonly maxFontSizeMultiplier: typeof tokens.typography.maxFontSizeMultiplier;
  readonly allowFontScaling: true;
}

export const snapWorthFontContract: SnapWorthFontContract = Object.freeze({
  requiredFaces: snapWorthFontFaces,
  displayFamily: tokens.typography.family.displayExtraBold,
  monetaryFamily: tokens.typography.family.displayExtraBold,
  bodyFamily: tokens.typography.family.bodyRegular,
  maxFontSizeMultiplier: tokens.typography.maxFontSizeMultiplier,
  allowFontScaling: true,
});
