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
import type { LucideIcon } from 'lucide-react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { haptic, held, themedStyles, tokens, useTheme, useThemedStyles } from '../design';
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
        // Outlined and shadowed like every card, the shadow cut to the tag's own shape.
        <Svg
          width={width + tagShadow + 2}
          height={height + tagShadow + 2}
          style={{ position: 'absolute', left: -1, top: -1 }}
          pointerEvents="none"
        >
          <G x={1 + tagShadow} y={1 + tagShadow}>
            <Path d={tagPath(width, height, nose)} fill={colors.heldShadow} />
          </G>
          <G x={1} y={1}>
            <Path
              d={tagPath(width, height, nose)}
              fill={colors.kraft}
              stroke={colors.heldEdge}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            <Circle
              cx={eyeletX}
              cy={height / 2}
              r={eyelet}
              fill={colors.canvas}
              stroke={colors.kraftEdge}
              strokeWidth={Math.max(1.2, eyelet * 0.32)}
            />
          </G>
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

/** How far the tag's hard shadow sits out, down and to the right. */
const tagShadow = 3;

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
/** Which side of its container a printed piece sits on, which sets its lean. */
export type PieceSide = 'start' | 'end';

export function Stamp({
  label,
  side = 'start',
  land,
  style,
}: {
  readonly label: string;
  readonly side?: PieceSide;
  /** Brings the stamp down onto the page after `delay` ms, with a thud you feel. */
  readonly land?: { readonly delay: number };
  readonly style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const delay = land?.delay;
  const pressed = useSharedValue(delay === undefined ? 1 : 0);
  const tilt = tokens.tilt[side];

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

export type SignTone = StickerTone | 'ink';

/**
 * A section's label, painted on a strip like a market stall's sign rather than set in grey
 * small capitals. Use it for the sections a page is browsed by ("Hot this month", "Steals").
 */
export function Sign({
  label,
  icon: Icon,
  tone = 'marigold',
  side = 'start',
  style,
}: {
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly tone?: SignTone;
  readonly side?: PieceSide;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const [fill, ink] = {
    marigold: [colors.marigold, colors.onMarigold],
    cobalt: [colors.cobalt, colors.onCobalt],
    accent: [colors.accent, colors.onAccent],
    ink: [colors.inverse, colors.onInverse],
  }[tone];
  return (
    <View
      accessibilityRole="header"
      style={[
        styles.sign,
        { backgroundColor: fill, transform: [{ rotate: `${tokens.tilt[side]}deg` }] },
        style,
      ]}
    >
      {Icon ? <Icon size={13} strokeWidth={2.4} color={ink} /> : null}
      <SWText variant="stamp" color={ink} numberOfLines={1}>
        {label}
      </SWText>
    </View>
  );
}

/**
 * A sticker slapped on a photo, the way a market stall marks a bargain: the community's verdict
 * on a price. Loud on purpose, so use one per photo at most.
 */
export function Sticker({
  label,
  tone = 'marigold',
  side = 'start',
  style,
}: {
  readonly label: string;
  readonly tone?: StickerTone;
  readonly side?: PieceSide;
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
        { backgroundColor: fill[0], transform: [{ rotate: `${tokens.tilt[side]}deg` }] },
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
  },
  sticker: {
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: 5,
    borderRadius: 10,
    // The same outline and hard shadow as everything else you can hold, lifting off the photo.
    ...held(colors, 2),
  },
  sign: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1] + 2,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[1] + 1,
    borderRadius: 5,
    ...held(colors, 2),
  },
}));
