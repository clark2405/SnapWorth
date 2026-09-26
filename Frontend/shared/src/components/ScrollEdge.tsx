import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../design';

export interface ScrollEdgeProps {
  /** How far from the top the edge stays nearly solid, e.g. the status bar plus the bar. */
  readonly solid: number;
  /** How far below that it dissolves into the content. */
  readonly fade?: number;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * The soft scroll edge iOS 26 puts under floating bars: the canvas thickens toward the top of
 * the screen so a title stays legible over whatever scrolls beneath, with no hard line where
 * the bar ends. A static gradient, so fading it in costs nothing and never drops the material.
 */
export function ScrollEdge({ solid, fade = 28, style }: ScrollEdgeProps) {
  const { colors } = useTheme();
  const id = `edge-${useId().replace(/:/g, '')}`;
  const height = solid + fade;

  return (
    <View style={[styles.edge, { height }, style]}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.canvas} stopOpacity={1} />
            <Stop offset={solid / height} stopColor={colors.canvas} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.canvas} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={height} fill={`url(#${id})`} />
      </Svg>
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
