import { tokens } from './tokens';

describe('SnapWorth design tokens', () => {
  it('deep-freezes the token source so themes and components cannot mutate it', () => {
    expect(Object.isFrozen(tokens)).toBe(true);
    expect(Object.isFrozen(tokens.color.light)).toBe(true);
    expect(Object.isFrozen(tokens.typography.style.priceHero)).toBe(true);
    expect(Object.isFrozen(tokens.motion.recipe.estimateWait)).toBe(true);
  });

  it('defines accessible targets, focus treatment, breakpoints, and text scaling centrally', () => {
    expect(tokens.focus.minimumTarget).toBeGreaterThanOrEqual(44);
    expect(tokens.layout.controlMinimum).toBe(tokens.focus.minimumTarget);
    expect(tokens.focus.ringWidth).toBeGreaterThan(0);
    expect(tokens.breakpoint.compactMin).toBe(320);
    expect(tokens.breakpoint.supportedMax).toBe(1920);
    expect(tokens.typography.maxFontSizeMultiplier.priceHero).toBe(1.6);
    expect(tokens.typography.maxFontSizeMultiplier.default).toBe(2);
  });

  it('keeps extended motion exclusive to estimation recipes and within declared deadlines', () => {
    expect(tokens.motion.recipe.estimateReveal.durationMs).toBe(tokens.motion.duration.reveal);
    expect(tokens.motion.recipe.estimateWait.repeats).toBe(true);
    expect(tokens.motion.recipe.estimateWait.delayMs).toBe(
      tokens.motion.duration.estimateProgressDelay,
    );
    expect(tokens.motion.duration.estimateOutcomeDeadline).toBe(10_000);

    for (const [name, recipe] of Object.entries(tokens.motion.recipe)) {
      if (name === 'estimateReveal' || name === 'estimateWait') continue;
      expect(recipe.durationMs).toBeLessThanOrEqual(tokens.motion.limits.maximumArtisticDuration);
      expect(recipe.repeats).toBe(false);
    }
  });
});
