import { tokens, type SemanticColorName, type ThemeName } from './tokens';

export type ThemePreference = ThemeName | 'system';
export type ThemeColors = Readonly<Record<SemanticColorName, string>>;
export type NativeWindThemeVariables = Readonly<Record<`--sw-color-${string}`, string>>;

export interface ResolvedTheme {
  readonly name: ThemeName;
  readonly colors: ThemeColors;
  readonly nativeWindVariables: NativeWindThemeVariables;
}

export type ContrastClassification = 'normal-text' | 'large-text' | 'ui-boundary';

export interface ContrastPairing {
  readonly foreground: SemanticColorName;
  readonly background: SemanticColorName;
  readonly classification: ContrastClassification;
}

export interface ContrastIssue extends ContrastPairing {
  readonly theme: ThemeName;
  readonly ratio: number;
  readonly minimum: number;
}

export const semanticColorNames = Object.freeze(
  Object.keys(tokens.color.light) as SemanticColorName[],
);

export const contrastPairings = Object.freeze<readonly ContrastPairing[]>([
  { foreground: 'textPrimary', background: 'canvas', classification: 'normal-text' },
  { foreground: 'textSecondary', background: 'canvas', classification: 'normal-text' },
  { foreground: 'textMuted', background: 'canvas', classification: 'normal-text' },
  { foreground: 'textPrimary', background: 'surface', classification: 'normal-text' },
  { foreground: 'textSecondary', background: 'surface', classification: 'normal-text' },
  { foreground: 'textMuted', background: 'surface', classification: 'normal-text' },
  { foreground: 'textPrimary', background: 'sunken', classification: 'normal-text' },
  { foreground: 'onAccent', background: 'accent', classification: 'normal-text' },
  { foreground: 'onAccent', background: 'accentPressed', classification: 'normal-text' },
  { foreground: 'textPrimary', background: 'estimateSurface', classification: 'normal-text' },
  { foreground: 'danger', background: 'canvas', classification: 'normal-text' },
  { foreground: 'warning', background: 'canvas', classification: 'normal-text' },
  { foreground: 'voteHigh', background: 'surface', classification: 'ui-boundary' },
  { foreground: 'voteLow', background: 'surface', classification: 'ui-boundary' },
  { foreground: 'voteRight', background: 'surface', classification: 'ui-boundary' },
  { foreground: 'focusRing', background: 'canvas', classification: 'ui-boundary' },
  { foreground: 'focusRing', background: 'surface', classification: 'ui-boundary' },
  { foreground: 'interactiveBoundary', background: 'canvas', classification: 'ui-boundary' },
  { foreground: 'interactiveBoundary', background: 'surface', classification: 'ui-boundary' },
]);

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function hexToRgbChannels(hex: string): string {
  const normalized = hex.slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `${red} ${green} ${blue}`;
}

export function nativeWindVariableName(name: SemanticColorName): `--sw-color-${string}` {
  return `--sw-color-${toKebabCase(name)}`;
}

export const nativeWindColorReferences = Object.freeze(
  Object.fromEntries(
    semanticColorNames.map((name) => [
      name,
      `rgb(var(${nativeWindVariableName(name)}) / <alpha-value>)`,
    ]),
  ) as Record<SemanticColorName, string>,
);

export function resolveThemeName(
  preference: ThemePreference,
  systemTheme: ThemeName = 'light',
): ThemeName {
  return preference === 'system' ? systemTheme : preference;
}

export function resolveTheme(
  preference: ThemePreference,
  systemTheme: ThemeName = 'light',
): ResolvedTheme {
  const name = resolveThemeName(preference, systemTheme);
  const colors = tokens.color[name];
  const nativeWindVariables = Object.freeze(
    Object.fromEntries(
      semanticColorNames.map((colorName) => [
        nativeWindVariableName(colorName),
        hexToRgbChannels(colors[colorName]),
      ]),
    ) as Record<`--sw-color-${string}`, string>,
  );

  return Object.freeze({ name, colors, nativeWindVariables });
}

function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const normalized = hex.slice(1);
  const red = channelToLinear(Number.parseInt(normalized.slice(0, 2), 16));
  const green = channelToLinear(Number.parseInt(normalized.slice(2, 4), 16));
  const blue = channelToLinear(Number.parseInt(normalized.slice(4, 6), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function getContrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function auditThemeContrast(theme: ThemeName): readonly ContrastIssue[] {
  const colors = tokens.color[theme];

  return contrastPairings.flatMap((pairing) => {
    const ratio = getContrastRatio(colors[pairing.foreground], colors[pairing.background]);
    const minimum = pairing.classification === 'normal-text' ? 4.5 : 3;

    return ratio >= minimum
      ? []
      : [{ ...pairing, theme, ratio, minimum } satisfies ContrastIssue];
  });
}
