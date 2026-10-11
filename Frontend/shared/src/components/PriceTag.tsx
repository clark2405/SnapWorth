import { useEffect, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import { SWText } from './SWText';

/**
 * The shape SnapWorth is named after: a manila price tag with a chamfered nose and a reinforced
 * eyelet, like the ones on a thrift-store rail. It is how the AI's appraisal is always shown,
 * so an estimate looks like an estimate before anyone reads it. Asking prices, which are the
 * seller's, never wear it.
 */
export function TagShape({
  children,
  style,
  hanging = false,
  tilt = 0,
  swing = false,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  /** Draws the string the tag hangs from, rising out of the eyelet. */
  readonly hanging?: boolean;
  /** Degrees the tag hangs off true, as a real one would. */
  readonly tilt?: number;
  /** Drops the tag onto its string as it appears, to swing once and settle. */
  readonly swing?: boolean;
}) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const nose = noseFor(height);
  const eyelet = Math.min(7, Math.max(3, height * 0.075));
  const eyeletX = nose * 0.55 + eyelet;
  const motion = useSwing(swing, tilt);
  // It swings from where the string is tied, above the eyelet, so the far end travels most.
  const stringLength = height * 0.9;
  const pivot = [
    eyeletX - Math.sin(stringAngle) * stringLength,
    height / 2 - Math.cos(stringAngle) * stringLength,
    0,
  ];

  return (
    <Animated.View
      style={[
        { paddingLeft: nose + eyelet * 2 + 6 },
        hanging ? { transformOrigin: pivot } : null,
        motion,
        style,
      ]}
      onLayout={(event: LayoutChangeEvent) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        if (w !== width || h !== height) setSize({ width: w, height: h });
      }}
    >
      {width > 0 ? (
        <Svg
          width={width}
          height={height}
          style={{ position: 'absolute', left: 0, top: 0 }}
          pointerEvents="none"
        >
          <Path d={tagPath(width, height, nose)} fill={colors.kraft} />
          <Circle
            cx={eyeletX}
            cy={height / 2}
            r={eyelet}
            fill={colors.canvas}
            stroke={colors.kraftEdge}
            strokeWidth={Math.max(1.2, eyelet * 0.32)}
          />
        </Svg>
      ) : null}
      {hanging && height > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: eyeletX - 0.75,
            bottom: height / 2,
            width: 1.5,
            height: stringLength,
            backgroundColor: colors.kraftEdge,
            transformOrigin: 'bottom',
            transform: [{ rotate: `${-stringAngle}rad` }],
          }}
        />
      ) : null}
      {children}
    </Animated.View>
  );
}

const stringAngle = (32 * Math.PI) / 180;

/**
 * The tag's hang: still at `tilt`, or, when it `swing`s, falling the last few points onto its
 * string, swinging back past true once and settling, the way a tag does when hung on a rail.
 * With reduced motion it is simply there.
 */
function useSwing(swing: boolean, tilt: number) {
  const reduceMotion = useReducedMotion();
  const animate = swing && !reduceMotion;
  const angle = useSharedValue(animate ? 11 : 0);
  const drop = useSharedValue(animate ? -26 : 0);

  useEffect(() => {
    if (!animate) return;
    const settle = Easing.inOut(Easing.sin);
    drop.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.back(2.2)) });
    angle.value = withSequence(
      withTiming(-6, { duration: 420, easing: Easing.out(Easing.quad) }),
      withTiming(2.5, { duration: 360, easing: settle }),
      withTiming(0, { duration: 300, easing: settle }),
    );
  }, [angle, animate, drop]);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: drop.value }, { rotate: `${tilt + angle.value}deg` }],
  }));
}

const noseFor = (height: number) => Math.min(20, Math.max(8, height * 0.28));

/** A rectangle whose left end is cut to a blunt point, with softly rounded right corners. */
function tagPath(width: number, height: number, nose: number) {
  const r = Math.min(8, height * 0.18);
  return [
    `M ${nose} 0`,
    `H ${width - r}`,
    `Q ${width} 0 ${width} ${r}`,
    `V ${height - r}`,
    `Q ${width} ${height} ${width - r} ${height}`,
    `H ${nose}`,
    `L 0 ${height - nose}`,
    `V ${nose}`,
    'Z',
  ].join(' ');
}

/**
 * A rubber stamp in the price-gun red, for the AI's confidence and other verdicts that are
 * declared rather than measured ("High confidence", "Sold").
 */
export function Stamp({
  label,
  tilt = -6,
  land,
  style,
}: {
  readonly label: string;
  readonly tilt?: number;
  /** Brings the stamp down onto the page after `delay` ms, with a thud you feel. */
  readonly land?: { readonly delay: number };
  readonly style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const delay = land?.delay;
  const pressed = useSharedValue(delay === undefined ? 1 : 0);

  useEffect(() => {
    if (delay === undefined) return;
    // Quick and accelerating, like a hand bringing it down; the thud is when it meets the page.
    const duration = reduceMotion ? tokens.motion.recipe.reducedCrossFade.durationMs : 150;
    pressed.value = withDelay(delay, withTiming(1, { duration, easing: Easing.in(Easing.quad) }));
    const thud = setTimeout(() => haptic('heavy'), delay + duration);
    return () => clearTimeout(thud);
  }, [delay, pressed, reduceMotion]);

  const motion = useAnimatedStyle(() => ({
    opacity: pressed.value,
    transform: [
      { rotate: `${tilt}deg` },
      { scale: reduceMotion ? 1 : 1 + (1 - pressed.value) * 0.9 },
    ],
  }));

  return (
    <Animated.View style={[styles.stamp, motion, style]}>
      <SWText variant="stamp" tone="accent">
        {label}
      </SWText>
    </Animated.View>
  );
}

export type StickerTone = 'marigold' | 'cobalt' | 'accent';

/**
 * A sticker slapped on a photo, the way a market stall marks a bargain: the community's verdict
 * on a price. Loud on purpose, so use one per photo at most.
 */
export function Sticker({
  label,
  tone = 'marigold',
  tilt = -4,
  style,
}: {
  readonly label: string;
  readonly tone?: StickerTone;
  readonly tilt?: number;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const fill = {
    marigold: [colors.marigold, colors.onMarigold],
    cobalt: [colors.cobalt, colors.onCobalt],
    accent: [colors.accent, colors.onAccent],
  }[tone];
  return (
    <View
      style={[
        styles.sticker,
        { backgroundColor: fill[0], transform: [{ rotate: `${tilt}deg` }] },
        style,
      ]}
    >
      <SWText variant="sticker" color={fill[1]}>
        {label}
      </SWText>
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  stamp: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 5,
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: 3,
    opacity: 0.92,
  },
  sticker: {
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.stickerOutline,
    // A hard offset shadow, like a sticker lifting off the photo.
    shadowColor: colors.stickerOutline,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
}));
