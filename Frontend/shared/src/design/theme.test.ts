import {
  auditThemeContrast,
  contrastPairings,
  getContrastRatio,
  nativeWindVariableName,
  resolveTheme,
  resolveThemeName,
  semanticColorNames,
  type ContrastClassification,
} from './theme';
import { tokens, type SemanticColorName, type ThemeName } from './tokens';

interface ThemeContrastCase {
  readonly background: SemanticColorName;
  readonly classification: ContrastClassification;
  readonly foreground: SemanticColorName;
  readonly minimum: number;
  readonly theme: ThemeName;
}

const themes = ['light', 'dark'] as const;
const themeContrastCases: ThemeContrastCase[] = themes.flatMap((theme) =>
  contrastPairings.map((pairing) => ({
    ...pairing,
    minimum: pairing.classification === 'normal-text' ? 4.5 : 3,
    theme,
  })),
);

describe('SnapWorth theme foundation', () => {
  it.each(themes)('%s theme resolves every semantic color and passes contrast', (name) => {
    const theme = resolveTheme(name);

    expect(Object.keys(theme.colors).sort()).toEqual([...semanticColorNames].sort());
    expect(Object.keys(theme.nativeWindVariables)).toHaveLength(semanticColorNames.length);
    expect(auditThemeContrast(name)).toEqual([]);
  });

  it.each(themeContrastCases)(
    '$theme $foreground on $background meets $minimum:1 contrast for $classification',
    ({ background, foreground, minimum, theme }) => {
      const colors = tokens.color[theme];
      const ratio = getContrastRatio(colors[foreground], colors[background]);

      expect(ratio).toBeGreaterThanOrEqual(minimum);
    },
  );

  it('resolves system and explicit preferences deterministically', () => {
    expect(resolveThemeName('system')).toBe('dark');
    expect(resolveThemeName('system', 'light')).toBe('light');
    expect(resolveThemeName('dark', 'light')).toBe('dark');
    expect(resolveThemeName('light', 'dark')).toBe('light');
  });

  it.each(themes)('%s exposes NativeWind channel variables without raw fallbacks', (name) => {
    const theme = resolveTheme(name);

    for (const colorName of semanticColorNames) {
      expect(theme.nativeWindVariables[nativeWindVariableName(colorName)]).toMatch(/^\d+ \d+ \d+$/);
      expect(theme.colors[colorName]).toBe(tokens.color[name][colorName]);
    }
  });
});
