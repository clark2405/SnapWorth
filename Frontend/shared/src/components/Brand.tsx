import type { ReactNode } from 'react';
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
  /** Makes the wordmark a pull-to-refresh indicator, every letter moving with the pull. */
  readonly motion?: WordmarkMotion;
}

/**
 * What drives the wordmark as a pull-to-refresh indicator. Pulled, its lens turns with the
 * finger; while the page reloads a wave keeps rolling through the letters, left to right, and
 * the lens keeps turning.
 */
export interface WordmarkMotion {
  /** How far the page is pulled: 0 at rest, 1 where it reloads. It can overshoot. */
  readonly pull: SharedValue<number>;
  /** Degrees, climbing steadily while the page reloads; one wave per turn. */
  readonly cycle: SharedValue<number>;
  /** 0 to 1, how strongly the reload wave plays; it eases in and out around a reload. */
  readonly wave: SharedValue<number>;
}

// Where the viewBox starts, for placing things over the lens in points.
const [viewMinX, viewMinY] = wordmarkPaths.viewBox.split(' ').map(Number) as [number, number];

interface Glyph {
  readonly d: string;
  readonly x0: number;
  readonly x1: number;
  readonly lens: boolean;
}

/** The horizontal extent of a path drawn with absolute M, L and Q commands. */
function extent(d: string): readonly [number, number] {
  const xs = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter((_, at) => at % 2 === 0);
  return [Math.min(...xs), Math.max(...xs)];
}

/**
 * The wordmark one letter at a time, left to right, so each can move on its own. A shape that
 * sits inside the one before it (the counter of the "p") belongs to that letter.
 */
const glyphs: readonly Glyph[] = (() => {
  const letters: { d: string; x0: number; x1: number; lens: boolean }[] = [];
  for (const part of wordmarkPaths.letters.split(/(?=M)/)) {
    const [x0, x1] = extent(part);
    const last = letters[letters.length - 1];
    if (last && x0 >= last.x0 && x1 <= last.x1) last.d += part;
    else letters.push({ d: part, x0, x1, lens: false });
  }
  const [ox0, ox1] = extent(wordmarkPaths.o);
  letters.push({ d: wordmarkPaths.o, x0: ox0, x1: ox1, lens: true });
  return letters.sort((a, b) => a.x0 - b.x0);
})();

/**
 * "snapworth", drawn rather than typed. The "o" is a camera lens in the one accent: you snap
 * it, and the price tag's eye tells you what it is worth.
 */
export function Wordmark({ height = 26, style, motion }: WordmarkProps) {
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
      {motion ? (
        glyphs.map((glyph, index) => (
          <MovingGlyph
            key={glyph.x0}
            glyph={glyph}
            index={index}
            scale={scale}
            height={height}
            motion={motion}
            fill={glyph.lens ? colors.accent : colors.textPrimary}
          >
            {glyph.lens ? (
              <FocusingLens
                motion={motion}
                size={glintBox}
                left={(lens.cx - glyph.x0) * scale - glintBox / 2}
                top={(lens.cy - viewMinY) * scale - glintBox / 2}
                pupil={pupil}
                glint={glint}
              />
            ) : null}
          </MovingGlyph>
        ))
      ) : (
        <Svg width={width} height={height} viewBox={wordmarkPaths.viewBox}>
          <Path d={wordmarkPaths.letters} fill={colors.textPrimary} />
          <Path d={wordmarkPaths.o} fill={colors.accent} />
          <Circle cx={lens.cx} cy={lens.cy} r={lens.counter * 0.62} fill={pupil} />
          <Circle
            cx={lens.cx + lens.counter * 0.3}
            cy={lens.cy - lens.counter * 0.3}
            r={lens.counter * 0.2}
            fill={glint}
          />
        </Svg>
      )}
    </View>
  );
}

// How far, in points at a 22pt wordmark, a letter rises at the crest of the reload wave.
const waveRise = 6;
// How much later each letter catches the reload wave than the one before it, in radians.
const waveLag = 0.62;

/** One letter on its own layer, so a reload can roll a wave through them, each a beat behind. */
function MovingGlyph({
  glyph,
  index,
  scale,
  height,
  motion,
  fill,
  children,
}: {
  readonly glyph: Glyph;
  readonly index: number;
  readonly scale: number;
  readonly height: number;
  readonly motion: WordmarkMotion;
  readonly fill: string;
  readonly children?: ReactNode;
}) {
  const size = height / 22;
  // Only the reload moves the letters, and it runs on the clock, not the finger, so a pull held
  // part way never leaves a letter hanging.
  const moving = useAnimatedStyle(() => {
    const crest = Math.max(0, Math.sin((motion.cycle.value * Math.PI) / 180 - index * waveLag));
    return { transform: [{ translateY: -crest * waveRise * motion.wave.value * size }] };
  });
  const width = (glyph.x1 - glyph.x0) * scale;
  return (
    <Animated.View
      style={[
        { position: 'absolute', top: 0, left: (glyph.x0 - viewMinX) * scale, width, height },
        moving,
      ]}
    >
      <Svg
        width={width}
        height={height}
        viewBox={`${glyph.x0} ${viewMinY} ${glyph.x1 - glyph.x0} ${wordmarkPaths.height}`}
      >
        <Path d={glyph.d} fill={fill} />
      </Svg>
      {children}
    </Animated.View>
  );
}

/**
 * The lens's pupil and glint on their own layer: the glint orbits with the pull and keeps
 * circling through a reload, and the pupil narrows and opens once per turn, like a lens finding
 * focus.
 */
function FocusingLens({
  motion,
  size,
  left,
  top,
  pupil,
  glint,
}: {
  readonly motion: WordmarkMotion;
  readonly size: number;
  readonly left: number;
  readonly top: number;
  readonly pupil: string;
  readonly glint: string;
}) {
  const focus = useAnimatedStyle(() => {
    const turn = Math.max(0, motion.pull.value) * 360 + motion.cycle.value;
    return {
      transform: [
        { scale: 1 - 0.24 * Math.abs(Math.sin((turn * Math.PI) / 360)) },
        { rotate: `${turn}deg` },
      ],
    };
  });
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
