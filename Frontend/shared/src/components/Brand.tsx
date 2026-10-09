import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { tokens, useTheme } from '../design';
import { tagPath, wordmarkPaths } from './brand-paths';

// The lens reads the same in both appearances: a cream ring around an ink pupil.
const lensRing = tokens.color.dark.textPrimary;
const lensPupil = tokens.color.light.textPrimary;

export interface WordmarkProps {
  /** Cap-to-descender height in points; the width follows. */
  readonly height?: number;
  readonly style?: StyleProp<ViewStyle>;
  /**
   * Degrees the lens's glint has turned around its pupil. Turning it makes the "o" the
   * pull-to-refresh indicator: it follows the pull, then keeps turning while the page reloads.
   */
  readonly spin?: SharedValue<number>;
}

// Where the viewBox starts, for placing things over the lens in points.
const [viewMinX, viewMinY] = wordmarkPaths.viewBox.split(' ').map(Number) as [number, number];

/**
 * "snapworth", drawn rather than typed. The "o" is a camera lens in the one accent: you snap
 * it, and the price tag's eye tells you what it is worth.
 */
export function Wordmark({ height = 26, style, spin }: WordmarkProps) {
  const { colors, isDark } = useTheme();
  const { lens } = wordmarkPaths;
  const width = (height * wordmarkPaths.width) / wordmarkPaths.height;
  const scale = height / wordmarkPaths.height;
  const glintBox = lens.counter * 2 * scale;
  // The pupil is the darkest thing on screen and its glint the lightest, in either appearance.
  const pupil = isDark ? colors.canvas : colors.textPrimary;
  const glint = isDark ? colors.textPrimary : colors.canvas;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="SnapWorth"
      style={[{ width, height }, style]}
    >
      <Svg width={width} height={height} viewBox={wordmarkPaths.viewBox}>
        <Path d={wordmarkPaths.letters} fill={colors.textPrimary} />
        <Path d={wordmarkPaths.o} fill={colors.accent} />
        {spin ? null : <Circle cx={lens.cx} cy={lens.cy} r={lens.counter * 0.62} fill={pupil} />}
        {spin ? null : (
          <Circle
            cx={lens.cx + lens.counter * 0.3}
            cy={lens.cy - lens.counter * 0.3}
            r={lens.counter * 0.2}
            fill={glint}
          />
        )}
      </Svg>
      {spin ? (
        <FocusingLens
          spin={spin}
          size={glintBox}
          left={(lens.cx - viewMinX) * scale - glintBox / 2}
          top={(lens.cy - viewMinY) * scale - glintBox / 2}
          pupil={pupil}
          glint={glint}
        />
      ) : null}
    </View>
  );
}

/**
 * The lens's pupil and glint on their own layer: as `spin` turns, the glint orbits and the
 * pupil narrows and opens once per turn, like a lens finding focus.
 */
function FocusingLens({
  spin,
  size,
  left,
  top,
  pupil,
  glint,
}: {
  readonly spin: SharedValue<number>;
  readonly size: number;
  readonly left: number;
  readonly top: number;
  readonly pupil: string;
  readonly glint: string;
}) {
  const focus = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 - 0.24 * Math.abs(Math.sin((spin.value * Math.PI) / 360)) },
      { rotate: `${spin.value}deg` },
    ],
  }));
  const c = size / 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left, top, width: size, height: size }, focus]}
    >
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={c * 0.62} fill={pupil} />
        <Circle cx={c + c * 0.3} cy={c - c * 0.3} r={c * 0.2} fill={glint} />
      </Svg>
    </Animated.View>
  );
}

export interface LogoMarkProps {
  readonly size?: number;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * The SnapWorth mark: a price tag hung at an angle, its eyelet a camera lens. Worth and the snap
 * that finds it, in one shape.
 */
export function LogoMark({ size = 48, style }: LogoMarkProps) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="SnapWorth"
      style={[{ width: size, height: size }, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <G transform="rotate(-45 50 50)">
          <Path d={tagPath} fill={colors.accent} />
          <Circle cx={50} cy={31} r={10.5} fill={lensRing} />
          <Circle cx={50} cy={31} r={7.2} fill={lensPupil} />
          <Circle cx={52.8} cy={28.2} r={2.1} fill={lensRing} />
        </G>
      </Svg>
    </View>
  );
}
