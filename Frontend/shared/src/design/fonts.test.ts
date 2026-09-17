import { snapWorthFontContract, snapWorthFontFaces } from './fonts';
import { tokens } from './tokens';

describe('SnapWorth font contract', () => {
  it('requires every family used by typography tokens', () => {
    const configuredFamilies = new Set(
      Object.values(tokens.typography.style).map((style) => style.family),
    );

    for (const family of configuredFamilies) {
      expect(snapWorthFontFaces).toContain(family);
    }
  });

  it('keeps scalable text enabled with documented multipliers', () => {
    expect(snapWorthFontContract.allowFontScaling).toBe(true);
    expect(snapWorthFontContract.maxFontSizeMultiplier.priceHero).toBe(1.6);
    expect(snapWorthFontContract.maxFontSizeMultiplier.default).toBe(2);
  });
});
