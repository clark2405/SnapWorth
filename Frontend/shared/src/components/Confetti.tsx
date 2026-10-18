import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { tokens, useTheme, type SemanticColorName } from '../design';

const pieceCount = 36;
const flightMs = 1600;

// Warm tonal paper only: the accent stays reserved for actions, even in a celebration.
const paperTones: readonly SemanticColorName[] = [
  'sandInk',
  'mintInk',
  'sand',
  'mint',
  'accentSoft',
  'graveInk',
  'textPrimary',
];

interface Piece {
  readonly tone: SemanticColorName;
  readonly launchX: number;
  readonly peakY: number;
  readonly driftX: number;
  readonly spin: number;
  readonly width: number;
  readonly height: number;
  readonly delay: number;
}

/**
 * A short burst of paper for the big payoff moments (a listing goes live, a post is up). Pieces
 * launch from the bottom centre on the signature expo-out, then fall under gravity while they
 * tumble. Each burst is keyed by `burst`; under reduced motion nothing is drawn at all.
 */
export function Confetti({ burst }: { readonly burst: number }) {
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();

  const pieces = useMemo<readonly Piece[]>(
    () =>
      Array.from({ length: pieceCount }, (_unused, index) => {
        // A cheap deterministic scatter per burst, so every celebration looks a little different.
        const seed = Math.sin((index + 1) * 12.9898 + burst * 78.233) * 43758.5453;
        const random = (offset: number) => {
          const value = Math.sin(seed + offset) * 10000;
          return value - Math.floor(value);
        };
        return {
          tone: paperTones[index % paperTones.length] ?? 'sandInk',
          launchX: (random(1) - 0.5) * width * 0.9,
          peakY: height * (0.35 + random(2) * 0.35),
          driftX: (random(3) - 0.5) * 80,
          spin: (random(4) - 0.5) * 900,
          width: 6 + random(5) * 6,
          height: 10 + random(6) * 8,
          delay: random(7) * 120,
        };
      }),
    [burst, height, width],
  );

  if (reduceMotion || burst === 0) return null;

  return (
    <View style={styles.layer} pointerEvents="none">
      {pieces.map((piece, index) => (
        <ConfettiPiece key={`${burst}-${index}`} piece={piece} origin={height} />
      ))}
    </View>
  );
}

function ConfettiPiece({ piece, origin }: { readonly piece: Piece; readonly origin: number }) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: flightMs + piece.delay, easing: Easing.linear });
  }, [piece.delay, progress]);

  const style = useAnimatedStyle(() => {
    const t = Math.max(0, progress.value * (flightMs + piece.delay) - piece.delay) / flightMs;
    // Rise fast and settle (expo-out), then fall under gravity past the bottom edge.
    const rise = 1 - Math.pow(2, -10 * Math.min(t / 0.35, 1));
    const fall = t > 0.35 ? Math.pow((t - 0.35) / 0.65, 2) : 0;
    const y = -piece.peakY * rise + (piece.peakY + origin * 0.25) * fall;
    return {
      opacity: t <= 0 ? 0 : 1 - Math.max(0, (t - 0.85) / 0.15),
      transform: [
        { translateX: piece.launchX * rise + piece.driftX * t },
        { translateY: y },
        { rotate: `${piece.spin * t}deg` },
        { rotateX: `${piece.spin * 0.6 * t}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          top: origin,
          width: piece.width,
          height: piece.height,
          backgroundColor: colors[piece.tone],
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 100,
  },
  piece: {
    position: 'absolute',
    borderRadius: tokens.radius.none + 2,
  },
});
