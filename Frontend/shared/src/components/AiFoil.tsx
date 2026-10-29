import { Sparkles } from 'lucide-react-native';
import { useEffect, useId, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { held, themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import { SWText } from './SWText';

const foil = tokens.holo;

/** An id for an SVG gradient: React's ids carry colons, which a `url(#…)` can't hold. */
function useGradientId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** The foil's colours as gradient stops, spread evenly. */
const foilStops = () =>
  foil.stops.map((color, index) => (
    <Stop key={color} offset={index / (foil.stops.length - 1)} stopColor={color} />
  ));

/** How long the light takes to cross the foil, and how long it rests between passes. */
const sheenMs = 900;
const restMs = 4800;

/**
 * The AI's mark: a holographic foil sticker reading "AI", slapped on whatever the AI worked out
 * (its estimate's tag, mostly). The foil's pastel shift reads as AI at a glance, the way an
 * authenticity sticker reads as checked, while staying cut paper like every other piece: an ink
 * outline and a hard shadow. With `shimmer`, light crosses the foil now and then; keep that to
 * one sticker on screen, never a list, and it rests with reduced motion.
 */
export function AiFoil({
  size = 'regular',
  shimmer = false,
  style,
}: {
  /** `large` for the AI's headline number, `small` inside a tag in a list. */
  readonly size?: 'large' | 'regular' | 'small';
  readonly shimmer?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const gradient = useGradientId('foil');
  const shine = useGradientId('sheen');
  const [box, setBox] = useState({ width: 0, height: 0 });
  const sweep = useSharedValue(0);
  const small = size === 'small';
  const large = size === 'large';

  useEffect(() => {
    if (!shimmer || reduceMotion || box.width === 0) return;
    sweep.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: sheenMs, easing: Easing.inOut(Easing.quad) }),
          withDelay(restMs, withTiming(0, { duration: 0 })),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(sweep);
  }, [box.width, reduceMotion, shimmer, sweep]);

  // The band of light starts off the left edge and leaves off the right.
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -box.width + sweep.value * box.width * 2 }],
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.sticker, styles[size], style]}
    >
      {/* The foil, clipped to the sticker inside its outline so the hard shadow still shows. */}
      <View
        style={[styles.foil, { borderRadius: small ? 4 : large ? 8 : 6 }]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width !== box.width || height !== box.height) setBox({ width, height });
        }}
      >
        {box.width > 0 ? (
          <Svg width={box.width} height={box.height}>
            <Defs>
              <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
                {foilStops()}
              </LinearGradient>
            </Defs>
            <Rect width={box.width} height={box.height} fill={`url(#${gradient})`} />
          </Svg>
        ) : null}
        {shimmer && box.width > 0 ? (
          <Animated.View style={[styles.sheen, sheenStyle]}>
            <Svg width={box.width} height={box.height}>
              <Defs>
                <LinearGradient id={shine} x1="0" y1="0" x2="1" y2="0.4">
                  <Stop offset={0.3} stopColor={foil.sheen} stopOpacity={0} />
                  <Stop offset={0.5} stopColor={foil.sheen} stopOpacity={0.85} />
                  <Stop offset={0.7} stopColor={foil.sheen} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect width={box.width} height={box.height} fill={`url(#${shine})`} />
            </Svg>
          </Animated.View>
        ) : null}
      </View>
      <Sparkles size={small ? 9 : large ? 16 : 12} strokeWidth={2.6} color={foil.ink} />
      <SWText variant={large ? 'sticker' : 'stamp'} color={foil.ink}>
        AI
      </SWText>
    </View>
  );
}

/**
 * The foil as a dot, for the AI's number shown without its tag (a price in a list row): the
 * same material, so the mark means the same thing everywhere.
 */
export function AiFoilDot({ size = 8 }: { readonly size?: number }) {
  const { colors } = useTheme();
  const gradient = useGradientId('dot');
  const r = size / 2;
  return (
    <Svg width={size} height={size} accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          {foilStops()}
        </LinearGradient>
      </Defs>
      <Circle
        cx={r}
        cy={r}
        r={r - 0.75}
        fill={`url(#${gradient})`}
        stroke={colors.heldEdge}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

const stylesFor = themedStyles((colors) => ({
  sticker: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    ...held(colors, 2),
  },
  large: {
    gap: tokens.spacing[1],
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: 5,
    borderRadius: 10,
  },
  regular: {
    gap: 3,
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: 3,
    borderRadius: 8,
  },
  small: {
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  foil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
}));
