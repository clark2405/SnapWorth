import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '../design';

export interface AmbientBackdropProps {
  /**
   * `value` (tab roots) and `aurora` (sign-in) lay a faint dot field over the canvas; `quiet`
   * leaves the canvas flat, for flows that should stay out of the way.
   */
  readonly mood?: 'value' | 'aurora' | 'quiet';
}

const cell = 24;
const driftMs = 9000;

/**
 * A flat canvas with a fine dot field that drifts one cell on a slow loop, so the page feels
 * alive without a single gradient. One pre-rendered pattern moved by transform only, so it costs
 * nothing per frame on the JS thread; under reduced motion it holds still.
 */
export function AmbientBackdrop({ mood = 'value' }: AmbientBackdropProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const drift = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || mood === 'quiet') return;
    drift.value = withRepeat(withTiming(1, { duration: driftMs, easing: Easing.linear }), -1);
    breathe.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(drift);
      cancelAnimation(breathe);
    };
  }, [breathe, drift, mood, reduceMotion]);

  // Moving exactly one cell makes the loop seamless: the last frame matches the first.
  const field = useAnimatedStyle(() => ({
    opacity: 0.75 + breathe.value * 0.25,
    transform: [{ translateX: -drift.value * cell }, { translateY: -drift.value * cell }],
  }));

  if (mood === 'quiet') return null;

  const fieldWidth = width + cell * 2;
  const fieldHeight = height + cell * 2;

  return (
    <View style={styles.layer}>
      <Animated.View style={[{ width: fieldWidth, height: fieldHeight }, field]}>
        <Svg width={fieldWidth} height={fieldHeight}>
          <Defs>
            <Pattern id="dots" width={cell} height={cell} patternUnits="userSpaceOnUse">
              <Circle
                cx={cell / 2}
                cy={cell / 2}
                r={1}
                fill={colors.textPrimary}
                fillOpacity={isDark ? 0.09 : 0.07}
              />
            </Pattern>
          </Defs>
          <Rect width={fieldWidth} height={fieldHeight} fill="url(#dots)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
});
