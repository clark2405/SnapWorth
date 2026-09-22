import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { resolveMotionRecipe, type ResolvedMotionRecipe } from './motion-recipe';
import type { MotionRecipeName } from './tokens';

export { resolveMotionRecipe } from './motion-recipe';
export type { MotionProperty, ResolvedMotionRecipe } from './motion-recipe';

export interface MotionPreference {
  readonly reduceMotion: boolean;
  readonly preferenceResolved: boolean;
  readonly resolveRecipe: (name: MotionRecipeName) => ResolvedMotionRecipe;
}

export function useMotionPreference(): MotionPreference {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [preferenceResolved, setPreferenceResolved] = useState(false);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((isEnabled) => {
      if (mounted) {
        setReduceMotion(isEnabled);
        setPreferenceResolved(true);
      }
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (isEnabled) => {
      if (mounted) {
        setReduceMotion(isEnabled);
        setPreferenceResolved(true);
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const resolveRecipe = useCallback(
    (name: MotionRecipeName) => resolveMotionRecipe(name, reduceMotion),
    [reduceMotion],
  );

  return Object.freeze({ reduceMotion, preferenceResolved, resolveRecipe });
}
