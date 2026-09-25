import { resolveFontFamily, snapWorthFontContract } from './fonts';
import { tokens } from './tokens';

describe('SnapWorth font contract', () => {
  it('uses only the semantic system families for every typography token', () => {
    const families = new Set(Object.keys(tokens.typography.family));

    for (const style of Object.values(tokens.typography.style)) {
      expect(families).toContain(style.family);
    }
  });

  it('resolves to Apple system designs on iOS and to named stacks on the web', () => {
    expect(resolveFontFamily('sans', 'ios')).toBeUndefined();
    expect(resolveFontFamily('serif', 'ios')).toBe('ui-serif');
    expect(resolveFontFamily('rounded', 'ios')).toBe('ui-rounded');
    expect(resolveFontFamily('serif', 'android')).toBe('serif');
    expect(resolveFontFamily('serif', 'web')).toBe(tokens.typography.webFamily.serif);
  });

  it('keeps scalable text enabled with documented multipliers', () => {
    expect(snapWorthFontContract.allowFontScaling).toBe(true);
    expect(snapWorthFontContract.maxFontSizeMultiplier.priceHero).toBe(1.4);
    expect(snapWorthFontContract.maxFontSizeMultiplier.default).toBe(2);
  });
});
