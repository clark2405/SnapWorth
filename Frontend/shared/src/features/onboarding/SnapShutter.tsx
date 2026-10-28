import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { haptic, placeColors, tokens, useTheme } from '../../design';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** When the shutter starts to close: once the cover has focused on Worthy's eye and dived in. */
export const shutterClosesAt = 600;
const closeMs = 170;
/** Held shut a beat after the click, so you see it closed: that's the snap. */
const holdMs = 150;
/** When the iris starts to open after the click: the first page comes alive from then. */
export const shutterOpensAfter = holdMs;
const openMs = 680;
const blades = 6;

/**
 * The snap between the cover and the tour: a camera iris in the brand's red, its blades cut
 * from the same paper as everything else (ink seams, an ink rim), closing over the lens the
 * cover has dived into. It shuts with a heavy click and a white flash, `onSnap` moves the app on
 * underneath, and the iris opens on the first page as the photo just taken.
 *
 * The iris is one shape, drawn fresh each frame: the screen with a hexagonal hole that shrinks
 * and turns as it closes, and a seam running on from each corner of the hole, the way a lens's
 * blades overlap. One path never shows a gap between blades.
 */
export function SnapShutter({
  run,
  width,
  height,
  onSnap,
}: {
  /** Set once, when Get started is pressed. */
  readonly run: boolean;
  readonly width: number;
  readonly height: number;
  readonly onSnap: () => void;
}) {
  const { colors } = useTheme();
  const red = placeColors(colors, 'feed').fill;
  const open = useSharedValue(1);
  const flash = useSharedValue(0);
  const shown = useSharedValue(0);
  const reach = Math.hypot(width, height);

  const snap = () => {
    haptic('heavy');
    onSnap();
    // A bright pop, gone before the iris opens, so the flash never hides the reveal.
    flash.value = withSequence(withTiming(0.9, { duration: 30 }), withTiming(0, { duration: 240 }));
    open.value = withDelay(
      holdMs,
      withTiming(1, { duration: openMs, easing: Easing.inOut(Easing.cubic) }, (done) => {
        if (done) shown.value = 0;
      }),
    );
  };

  useEffect(() => {
    if (!run) return;
    shown.value = 1;
    open.value = withDelay(
      shutterClosesAt,
      withTiming(0, { duration: closeMs, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(snap)();
      }),
    );
    // Runs once per press: snap reads only stable shared values and the latest onSnap.
  }, [run]);

  /** The hole's corners: radius from wide open (past the screen's corners) down to nothing. */
  const corners = (o: number) => {
    'worklet';
    const radius = o * reach * 0.62;
    const turn = (1 - o) * 0.95;
    const cx = width / 2;
    const cy = height / 2;
    const points: [number, number][] = [];
    for (let i = 0; i < blades; i++) {
      const a = turn + (i * Math.PI * 2) / blades;
      points.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
    }
    return points;
  };
  const hole = (points: [number, number][]) => {
    'worklet';
    return `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} Z`;
  };

  const bladeProps = useAnimatedProps(() => ({
    d: `M0 0 H${width} V${height} H0 Z ${hole(corners(open.value))}`,
  }));
  const rimProps = useAnimatedProps(() => ({ d: hole(corners(open.value)) }));
  // Each seam runs on from a corner of the hole along the side that ends there; where the hole
  // has closed to a point, the sides have no direction, so the seams fan out from the centre.
  const seams = (o: number) => {
    'worklet';
    const points = corners(o);
    const ends: [number, number][] = [];
    for (let i = 0; i < blades; i++) {
      const [x, y] = points[i] ?? [0, 0];
      const [px, py] = points[(i + blades - 1) % blades] ?? [0, 0];
      const length = Math.hypot(x - px, y - py);
      const a = (1 - o) * 0.95 + (i * Math.PI * 2) / blades + Math.PI / 2;
      const dx = length > 1 ? (x - px) / length : Math.cos(a);
      const dy = length > 1 ? (y - py) / length : Math.sin(a);
      ends.push([x + dx * reach, y + dy * reach]);
    }
    return { points, ends };
  };
  const seamProps = useAnimatedProps(() => {
    const { points, ends } = seams(open.value);
    let d = '';
    for (let i = 0; i < blades; i++) {
      const [x, y] = points[i] ?? [0, 0];
      const [ex, ey] = ends[i] ?? [0, 0];
      d += `M${x.toFixed(1)} ${y.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)} `;
    }
    return { d };
  });
  // Every other blade a shade deeper, so they read as overlapping leaves, not one flat red.
  const shadeProps = useAnimatedProps(() => {
    const { points, ends } = seams(open.value);
    let d = '';
    for (let i = 1; i < blades; i += 2) {
      const next = (i + 1) % blades;
      const [x, y] = points[i] ?? [0, 0];
      const [ex, ey] = ends[i] ?? [0, 0];
      const [nx, ny] = points[next] ?? [0, 0];
      const [nex, ney] = ends[next] ?? [0, 0];
      d += `M${x.toFixed(1)} ${y.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)} L${nex.toFixed(1)} ${ney.toFixed(1)} L${nx.toFixed(1)} ${ny.toFixed(1)} Z `;
    }
    return { d };
  });
  const layer = useAnimatedStyle(() => ({ opacity: shown.value }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  if (width === 0) return null;
  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.top, layer]} pointerEvents="none">
        <Svg width={width} height={height}>
          <AnimatedPath animatedProps={bladeProps} fill={red} fillRule="evenodd" />
          <AnimatedPath animatedProps={shadeProps} fill={colors.accent} />
          <AnimatedPath
            animatedProps={seamProps}
            fill="none"
            stroke={colors.heldEdge}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <AnimatedPath
            animatedProps={rimProps}
            fill="none"
            stroke={colors.heldEdge}
            strokeWidth={3.5}
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.top, styles.flash, flashStyle]}
        pointerEvents="none"
      />
    </>
  );
}

const styles = StyleSheet.create({
  top: {
    zIndex: 20,
  },
  flash: {
    backgroundColor: tokens.overlay.text,
  },
});
