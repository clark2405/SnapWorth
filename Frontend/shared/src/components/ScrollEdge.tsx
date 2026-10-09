import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { useId, type RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../design';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export interface ScrollEdgeProps {
  /** How far from the top the edge stays at full strength, e.g. the status bar plus the bar. */
  readonly solid: number;
  /** How far below that it dissolves into the content. */
  readonly fade?: number;
  /**
   * How present the edge is, 0 to 1, usually driven by the scroll. The blur's own strength and
   * the wash follow it, so the edge grows in. Fading a parent's opacity instead would break the
   * blur, which iOS only draws properly at full opacity, so it would pop in at the end.
   */
  readonly progress?: SharedValue<number>;
  readonly style?: StyleProp<ViewStyle>;
  /** An optional target ref for Android native blur when wrapped in BlurTargetView. */
  readonly blurTarget?: RefObject<View | null>;
}

interface EdgeStop {
  readonly offset: number;
  readonly opacity: number;
}

/**
 * Stops that hold `opacity` until `from`, then ease it to nothing at `to` along a smoothstep, so
 * the edge has no visible start or end.
 */
function easedStops(opacity: number, from: number, to = 1, steps = 8): EdgeStop[] {
  const stops: EdgeStop[] = [{ offset: 0, opacity }];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const eased = 1 - t * t * (3 - 2 * t);
    stops.push({ offset: from + (to - from) * t, opacity: opacity * eased });
  }
  return stops;
}

/**
 * The soft scroll edge iOS 26 puts under floating bars: a progressive blur, strongest at the
 * top of the screen and easing to nothing below the bar, over a light wash of the canvas so
 * nothing that scrolls beneath competes with the title. The blur is two layers, a strong one
 * close to the top and a light one reaching further down, so it thins out gradually rather
 * than cross-fading sharp content into blurred. There is no line where the bar ends. The web,
 * without native blur masking, gets the wash alone.
 */
export function ScrollEdge({ solid, fade = 72, progress, style, blurTarget }: ScrollEdgeProps) {
  const { colors, isDark } = useTheme();
  const id = `edge-${useId().replace(/:/g, '')}`;
  const height = solid + fade;
  const solidEnd = solid / height;

  const always = useSharedValue(1);
  const presence = progress ?? always;
  const strongIntensity = isDark ? 34 : 28;
  const softIntensity = isDark ? 14 : 10;
  const strongProps = useAnimatedProps(() => ({ intensity: presence.value * strongIntensity }));
  const softProps = useAnimatedProps(() => ({ intensity: presence.value * softIntensity }));
  const washStyle = useAnimatedStyle(() => ({ opacity: presence.value }));

  const gradient = (name: string, stops: readonly EdgeStop[]) => (
    <Svg width="100%" height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`${id}-${name}`} x1="0" y1="0" x2="0" y2="1">
          {stops.map((stop, index) => (
            <Stop
              key={index}
              offset={stop.offset}
              stopColor={colors.canvas}
              stopOpacity={stop.opacity}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect width="100%" height={height} fill={`url(#${id}-${name})`} />
    </Svg>
  );

  // Enough of the canvas to keep the title legible over a busy photo, eased out well below it.
  const wash = (
    <Animated.View style={[StyleSheet.absoluteFill, washStyle]}>
      {gradient('wash', easedStops(0.86, solidEnd * 0.7))}
    </Animated.View>
  );

  if (Platform.OS === 'web') {
    return <View style={[styles.edge, { height }, style]}>{wash}</View>;
  }

  return (
    <View style={[styles.edge, { height }, style]}>
      {/* Only a mask's alpha matters: opaque keeps the blur, transparent lets content through. */}
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={gradient('soft', easedStops(1, solidEnd * 0.5))}
      >
        <AnimatedBlurView
          animatedProps={softProps}
          tint={isDark ? 'dark' : 'light'}
          blurTarget={blurTarget}
          blurMethod={blurTarget ? 'dimezisBlurView' : undefined}
          style={StyleSheet.absoluteFill}
        />
      </MaskedView>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={gradient('strong', easedStops(1, solidEnd * 0.35, solidEnd))}
      >
        <AnimatedBlurView
          animatedProps={strongProps}
          tint={isDark ? 'dark' : 'light'}
          blurTarget={blurTarget}
          blurMethod={blurTarget ? 'dimezisBlurView' : undefined}
          style={StyleSheet.absoluteFill}
        />
      </MaskedView>
      {wash}
    </View>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },
});
