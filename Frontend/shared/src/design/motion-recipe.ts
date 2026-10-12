import { tokens, type MotionRecipeName } from './tokens';

export type MotionProperty = 'opacity' | 'transform' | 'layout' | 'count-up';

export interface ResolvedMotionRecipe {
  readonly name: MotionRecipeName;
  readonly durationMs: number;
  readonly easing: string;
  readonly properties: readonly MotionProperty[];
  readonly repeats: boolean;
  readonly delayMs?: number;
  readonly restMs?: number;
}

export function resolveMotionRecipe(
  name: MotionRecipeName,
  reduceMotion: boolean,
): ResolvedMotionRecipe {
  const standard = tokens.motion.recipe[name];

  if (!reduceMotion) {
    return Object.freeze({ name, ...standard });
  }

  const reduced =
    name === 'immediate' ? tokens.motion.recipe.immediate : tokens.motion.recipe.reducedCrossFade;
  return Object.freeze({ name, ...reduced });
}
