import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { useId, type RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../design';

export interface ScrollEdgeProps {
  /** How far from the top the edge stays at full strength, e.g. the status bar plus the bar. */
  readonly solid: number;
  /** How far below that it dissolves into the content. */
  readonly fade?: number;
  readonly style?: StyleProp<ViewStyle>;
  /** An optional target ref for Android native blur when wrapped in BlurTargetView. */
  readonly blurTarget?: RefObject<View | null>;
}

/**
 * The soft scroll edge iOS 26 puts under floating bars: a progressive blur, strongest at the
 * top of the screen and easing to nothing below the bar, over a near-solid wash of the canvas
 * so nothing that scrolls beneath ever competes with the title. There is no line where the bar ends. The
 * web, without native blur masking, gets the wash alone.
 */
export function ScrollEdge({ solid, fade = 44, style, blurTarget }: ScrollEdgeProps) {
  const { colors, isDark } = useTheme();
  const id = `edge-${useId().replace(/:/g, '')}`;
  const height = solid + fade;
  // The blur holds full strength across the top of the bar, then ramps out through the fade.
  const blurFull = (solid * 0.55) / height;
  const washEnd = solid / height;

  const wash = (
    <Svg width="100%" height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`${id}-wash`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.canvas} stopOpacity={0.97} />
          <Stop offset={washEnd} stopColor={colors.canvas} stopOpacity={0.92} />
          <Stop offset="1" stopColor={colors.canvas} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height={height} fill={`url(#${id}-wash)`} />
    </Svg>
  );

  if (Platform.OS === 'web') {
    return <View style={[styles.edge, { height }, style]}>{wash}</View>;
  }

  return (
    <View style={[styles.edge, { height }, style]}>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          // Only the mask's alpha matters: opaque keeps the blur, transparent lets content through.
          <Svg width="100%" height={height}>
            <Defs>
              <LinearGradient id={`${id}-mask`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.canvas} stopOpacity={1} />
                <Stop offset={blurFull} stopColor={colors.canvas} stopOpacity={1} />
                <Stop offset="1" stopColor={colors.canvas} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height={height} fill={`url(#${id}-mask)`} />
          </Svg>
        }
      >
        <BlurView
          intensity={isDark ? 36 : 30}
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
