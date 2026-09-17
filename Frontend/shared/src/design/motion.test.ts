import { resolveMotionRecipe } from './motion-recipe';
import { tokens, type MotionRecipeName } from './tokens';

const recipeNames = Object.keys(tokens.motion.recipe) as MotionRecipeName[];

describe('SnapWorth motion recipes', () => {
  it.each(recipeNames)('preserves the named standard recipe for %s', (name) => {
    const resolved = resolveMotionRecipe(name, false);

    expect(resolved.name).toBe(name);
    expect(resolved).toEqual({ name, ...tokens.motion.recipe[name] });
    expect(Object.isFrozen(resolved)).toBe(true);
  });

  it.each(recipeNames)(
    'removes transform, count-up, layout, repeat, stagger, and wait behavior for %s',
    (name) => {
      const resolved = resolveMotionRecipe(name, true);

      expect(resolved.properties).not.toContain('transform');
      expect(resolved.properties).not.toContain('count-up');
      expect(resolved.properties).not.toContain('layout');
      expect(resolved.repeats).toBe(false);
      expect(resolved.delayMs).toBeUndefined();
      expect(resolved.restMs).toBeUndefined();
      expect(resolved.durationMs).toBe(
        name === 'immediate'
          ? tokens.motion.recipe.immediate.durationMs
          : tokens.motion.recipe.reducedCrossFade.durationMs,
      );
    },
  );
});
