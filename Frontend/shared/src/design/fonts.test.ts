import { fontFaces, resolveFontFace, resolveFontFamily, snapWorthFontContract } from './fonts';
import { tokens } from './tokens';

describe('SnapWorth font contract', () => {
  it('uses only the semantic families for every typography token', () => {
    const families = new Set(Object.keys(tokens.typography.family));

    for (const style of Object.values(tokens.typography.style)) {
      expect(families).toContain(style.family);
    }
  });

  it('has a bundled face for every weight a typography token uses', () => {
    for (const style of Object.values(tokens.typography.style)) {
      expect(Object.keys(fontFaces)).toContain(style.weight);
    }
  });

  it('resolves every family to the face for its weight', () => {
    expect(resolveFontFamily('display', '700')).toBe('PlusJakartaSans_700Bold');
    expect(resolveFontFamily('sans', '400')).toBe('PlusJakartaSans_400Regular');
    expect(resolveFontFamily('rounded', '600')).toBe('PlusJakartaSans_600SemiBold');
    expect(resolveFontFace('900')).toBe(fontFaces['400']);
  });

  it('keeps scalable text enabled with documented multipliers', () => {
    expect(snapWorthFontContract.allowFontScaling).toBe(true);
    expect(snapWorthFontContract.maxFontSizeMultiplier.priceHero).toBe(1.4);
    expect(snapWorthFontContract.maxFontSizeMultiplier.default).toBe(2);
  });
});
