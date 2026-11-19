import { X } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CountUp, PressableScale, SWText, Worthy } from '../../components';
import { held, tokens, useTheme } from '../../design';

export type EstimatingStage = 'looking' | 'estimating';

/** Something Worthy really found in the photo, worn as a sticker on the print. */
export interface FoundSticker {
  readonly label: string;
  readonly value: string;
}

/** What Worthy is doing, a line at a time, on the "still checking" sticker. Nothing here claims a search it didn't do. */
const lines: Readonly<Record<EstimatingStage, readonly string[]>> = {
  looking: ['Checking the light…', 'Reading any labels…', 'Finding the item…'],
  estimating: [
    'Working out what it is…',
    'Looking at the wear…',
    'Weighing it up…',
    'Putting a price on it…',
  ],
};

/** The hard ink shadow `held` casts, without its border. */
function shadowOf(color: string, depth: number) {
  return Platform.OS === 'android'
    ? { boxShadow: `${depth}px ${depth}px 0px ${color}` }
    : {
        shadowColor: color,
        shadowOffset: { width: depth, height: depth },
        shadowOpacity: 1,
        shadowRadius: 0,
      };
}

/** The print is a physical thing, so it stays card stock at night, as the tags stay manila. */
const cardStock = tokens.illustration.cardStock;

// The print and what hangs off it, laid out on a stage of a fixed width.
const stageWidth = 340;
const printPhoto = { width: 208, height: 222 };
const resultPhoto = { width: 176, height: 182 };
const loupeSize = 84;
const loupeZoom = 2.4;
const digitHeight = 46;

/**
 * The red band across the top of the snap screens, its bottom edge scalloped like a ticket stub:
 * the close button, what's happening, and the steps or what was saved.
 */
function SnapBand({
  topInset,
  onClose,
  trailing,
  children,
}: {
  readonly topInset: number;
  readonly onClose?: () => void;
  readonly trailing?: ReactNode;
  readonly children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.band,
        { backgroundColor: colors.placeFeed, paddingTop: topInset + tokens.spacing[3] },
      ]}
    >
      <View style={styles.bandTop}>
        {onClose ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Close camera"
            haptic="select"
            onPress={onClose}
            style={[styles.close, { backgroundColor: colors.canvas }, held(colors, 0)]}
          >
            <X size={18} strokeWidth={2.4} color={colors.textPrimary} />
          </PressableScale>
        ) : (
          <View />
        )}
        {trailing}
      </View>
      {children}
      <View pointerEvents="none" style={styles.scallops}>
        {Array.from({ length: 24 }, (_, index) => (
          <View key={index} style={[styles.scallop, { backgroundColor: colors.placeFeed }]} />
        ))}
      </View>
    </View>
  );
}

/** LOOK · READ · PRICE, the step under way bright and the ones to come faded. */
function Steps({ stage }: { readonly stage: EstimatingStage }) {
  const { colors } = useTheme();
  const steps =
    stage === 'looking'
      ? ([
          ['LOOK', 'now'],
          ['READ', 'next'],
          ['PRICE', 'next'],
        ] as const)
      : ([
          ['LOOK', 'done'],
          ['READ', 'done'],
          ['PRICE', 'now'],
        ] as const);
  return (
    <View
      style={styles.steps}
      accessible
      accessibilityLabel={stage === 'looking' ? 'Step 1 of 3, looking' : 'Step 3 of 3, pricing'}
    >
      {steps.map(([label, state]) => (
        <View key={label} style={[styles.step, { opacity: state === 'next' ? 0.55 : 1 }]}>
          <View
            style={[
              styles.stepDot,
              {
                borderColor: colors.onPlaceFeed,
                backgroundColor: state === 'done' ? colors.onPlaceFeed : 'transparent',
              },
            ]}
          />
          <SWText variant="stamp" color={colors.onPlaceFeed}>
            {label}
          </SWText>
        </View>
      ))}
    </View>
  );
}

/** A found fact on the print, or (`pending`) the dashed one for what's still being checked. */
function Sticker({
  label,
  value,
  pending = false,
  tilt,
  style,
}: {
  readonly label: string;
  readonly value: string;
  readonly pending?: boolean;
  readonly tilt: number;
  readonly style: object;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const fade = useSharedValue(1);
  useEffect(() => {
    if (!pending || reduceMotion) return;
    fade.value = withRepeat(withTiming(0.45, { duration: 700 }), -1, true);
    return () => cancelAnimation(fade);
  }, [fade, pending, reduceMotion]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(260)}
      style={[
        styles.sticker,
        pending
          ? {
              backgroundColor: colors.canvas,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: colors.heldEdge,
            }
          : [{ backgroundColor: colors.surface }, held(colors, 3)],
        { transform: [{ rotate: `${tilt}deg` }] },
        style,
      ]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Animated.View style={pending ? fadeStyle : null}>
        <SWText variant="stamp" color={colors.textMuted}>
          {label}
        </SWText>
        <SWText variant="label" color={pending ? colors.textSecondary : colors.textPrimary}>
          {value}
        </SWText>
      </Animated.View>
    </Animated.View>
  );
}

/** One wheel of the price gun, its digits rolling past until the real price comes. */
function DigitWheel({
  digits,
  durationMs,
}: {
  readonly digits: string;
  readonly durationMs: number;
}) {
  const { colors } = useTheme();
  const roll = useSharedValue(0);
  useEffect(() => {
    roll.value = withRepeat(
      withTiming(-digitHeight * digits.length, { duration: durationMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(roll);
  }, [digits.length, durationMs, roll]);
  const rollStyle = useAnimatedStyle(() => ({ transform: [{ translateY: roll.value }] }));
  return (
    <View style={styles.wheel}>
      <Animated.View style={rollStyle}>
        {[...digits, ...digits].map((digit, index) => (
          <View key={index} style={styles.digitCell}>
            <SWText variant="priceLarge" color={colors.kraftInk}>
              {digit}
            </SWText>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * The kraft tag hanging off the print: Worthy's guess, its digits rolling while he works (still
 * question marks with Reduce Motion), then the price once it's in.
 */
function PriceTag({
  amountPhp,
  formatPrice,
}: {
  readonly amountPhp?: number;
  readonly formatPrice?: (amount: number) => string;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const priced = amountPhp !== undefined && formatPrice !== undefined;
  return (
    <View
      style={[styles.tag, { backgroundColor: colors.kraft }, held(colors, 5)]}
      accessible
      accessibilityLabel={
        priced ? `AI estimate, ${formatPrice(amountPhp)}` : 'Working out the price'
      }
    >
      <View
        style={[styles.eyelet, { borderColor: colors.heldEdge, backgroundColor: colors.canvas }]}
      />
      <View style={styles.tagHead}>
        <View style={[styles.aiChip, { backgroundColor: colors.kraftInk }]}>
          <SWText variant="stamp" color={colors.kraft}>
            AI
          </SWText>
        </View>
        <SWText variant="stamp" color={colors.kraftInk}>
          {priced ? 'ESTIMATE' : 'WORTHY’S GUESS'}
        </SWText>
      </View>
      {priced ? (
        <CountUp
          value={amountPhp}
          format={formatPrice}
          variant="priceLarge"
          color={colors.kraftInk}
        />
      ) : reduceMotion ? (
        <SWText variant="priceLarge" color={colors.kraftInk}>
          ₱?,???
        </SWText>
      ) : (
        <View style={styles.wheels}>
          <View style={styles.digitCell}>
            <SWText variant="priceLarge" color={colors.kraftInk}>
              ₱
            </SWText>
          </View>
          <DigitWheel digits="1234" durationMs={850} />
          <View style={styles.commaCell}>
            <SWText variant="priceLarge" color={colors.kraftInk}>
              ,
            </SWText>
          </View>
          <DigitWheel digits="3805" durationMs={560} />
          <DigitWheel digits="5027" durationMs={420} />
          <View style={styles.digitCell}>
            <SWText variant="priceLarge" color={colors.kraftInk}>
              0
            </SWText>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * The photo as a print taped to the page. While Worthy looks, a loupe roams over it, really
 * magnifying the part of the photo beneath it.
 */
function Print({
  photoUri,
  size,
  label,
  scanning,
}: {
  readonly photoUri: string;
  readonly size: { readonly width: number; readonly height: number };
  readonly label: string;
  readonly scanning: boolean;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const path = useSharedValue(0);
  const roam = scanning && !reduceMotion;

  useEffect(() => {
    if (!roam) return;
    const leg = (to: number) =>
      withTiming(to, { duration: 2000, easing: Easing.inOut(Easing.sin) });
    path.value = withRepeat(
      withSequence(withTiming(0, { duration: 0 }), leg(1), leg(2), leg(3)),
      -1,
    );
    return () => cancelAnimation(path);
  }, [path, roam]);

  // Where the loupe's corner goes: top left, across to the right, down to the left, home.
  const xs = [12, size.width - loupeSize - 14, 30, 12];
  const ys = [12, 40, size.height - loupeSize - 14, 12];
  const loupeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(path.value, [0, 1, 2, 3], xs) },
      { translateY: interpolate(path.value, [0, 1, 2, 3], ys) },
    ],
  }));
  const lensStyle = useAnimatedStyle(() => {
    const x = interpolate(path.value, [0, 1, 2, 3], xs);
    const y = interpolate(path.value, [0, 1, 2, 3], ys);
    return {
      transform: [
        { translateX: -((x + loupeSize / 2) * loupeZoom - loupeSize / 2) },
        { translateY: -((y + loupeSize / 2) * loupeZoom - loupeSize / 2) },
      ],
    };
  });

  return (
    // A frame of ink behind the card rather than a border on it: iOS draws a thick border on a
    // rotated view as dashes.
    <View
      style={[
        styles.printFrame,
        { backgroundColor: colors.heldEdge },
        shadowOf(colors.heldShadow, 6),
      ]}
    >
      <View style={[styles.print, { backgroundColor: cardStock }]}>
        <View style={[styles.photoWindow, size]}>
          <Image
            source={{ uri: photoUri }}
            accessibilityLabel={label}
            resizeMode="cover"
            style={size}
          />
          {roam ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.loupe,
                { borderColor: colors.heldEdge, shadowColor: colors.canvas },
                loupeStyle,
              ]}
            >
              <Animated.View style={lensStyle}>
                <Image
                  source={{ uri: photoUri }}
                  resizeMode="cover"
                  style={{ width: size.width * loupeZoom, height: size.height * loupeZoom }}
                />
              </Animated.View>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** The string from the print's corner to the tag's eyelet. */
function TagString({ style }: { readonly style: object }) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[styles.string, { backgroundColor: colors.heldEdge }, style]}
    />
  );
}

/**
 * The wait between the shutter and the estimate. The red band says what's happening and how far
 * along; the photo lies on the page as a print with a loupe roaming over it; what Worthy has
 * really found is stuck on as stickers (two at most, so the photo stays the thing to look at);
 * and the kraft tag hanging off it rolls its digits like a price gun until the price comes.
 */
export function EstimatingScene({
  photoUri,
  stage,
  looksLike,
  labelRead,
  topInset = 0,
  onClose,
}: {
  readonly photoUri: string;
  readonly stage: EstimatingStage;
  /** What the phone made of the item, once it knows ("High top sneakers · Nike"). */
  readonly looksLike?: string;
  /** Printed text the phone read off the item (a brand, a size), when it found some. */
  readonly labelRead?: string;
  readonly topInset?: number;
  readonly onClose?: () => void;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [line, setLine] = useState(0);
  const hop = useSharedValue(0);
  const swing = useSharedValue(0);

  useEffect(() => {
    setLine(0);
    const timer = setInterval(
      () => setLine((current) => (current + 1) % lines[stage].length),
      2200,
    );
    return () => clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (reduceMotion) return;
    hop.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 340, easing: Easing.in(Easing.quad) }),
        withTiming(0, { duration: 360 }),
      ),
      -1,
    );
    swing.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(hop);
      cancelAnimation(swing);
    };
  }, [hop, reduceMotion, swing]);

  const hopStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -hop.value * 10 }, { rotate: `${-6 + hop.value * 10}deg` }],
  }));
  const swingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${1 + swing.value * 5}deg` }],
  }));

  const item = looksLike?.split(' · ')[0];
  const headline =
    stage === 'looking'
      ? 'Let me take a look…'
      : item
        ? `${item.charAt(0).toUpperCase()}${item.slice(1)}. Pricing it…`
        : 'Pricing your item…';
  const found: FoundSticker[] = [
    ...(labelRead ? [{ label: 'LABEL', value: `“${labelRead}”` }] : []),
    ...(looksLike ? [{ label: 'LOOKS LIKE', value: looksLike }] : []),
  ].slice(0, 2);

  return (
    <View style={styles.scene} accessibilityLiveRegion="polite">
      <SnapBand topInset={topInset} onClose={onClose} trailing={<Steps stage={stage} />}>
        <View style={styles.headlineRow}>
          <SWText
            variant="displayMedium"
            color={colors.onPlaceFeed}
            style={styles.headline}
            accessibilityRole="header"
          >
            {headline}
          </SWText>
          <Animated.View style={hopStyle}>
            <Worthy size={46} mood={stage === 'looking' ? 'attentive' : 'thinking'} />
          </Animated.View>
        </View>
      </SnapBand>

      <View style={[styles.stage, { height: 400 }]}>
        <View style={[styles.printSlot, { left: 14, top: 8, transform: [{ rotate: '-3deg' }] }]}>
          <Print photoUri={photoUri} size={printPhoto} label="Your photo" scanning />
        </View>
        {found[0] ? <Sticker {...found[0]} tilt={-3} style={{ left: 196, top: 0 }} /> : null}
        {found.length < 2 ? (
          <Sticker
            label="CHECKING"
            value={lines[stage][line] ?? ''}
            pending
            tilt={2}
            style={{ left: 0, top: 222 }}
          />
        ) : (
          <Sticker {...found[1]!} tilt={2} style={{ left: 0, top: 222 }} />
        )}
        <TagString style={{ left: 234, top: 262, height: 32, transform: [{ rotate: '-18deg' }] }} />
        <Animated.View style={[styles.tagSlot, { left: 124, top: 286 }, swingStyle]}>
          <PriceTag />
        </Animated.View>
      </View>

      <SWText variant="caption" color={colors.textMuted} align="center">
        An AI guess, not a sale price.
      </SWText>
    </View>
  );
}

/**
 * The snap's result: the band names the item, the print keeps what was found stuck on it, and the
 * tag lands with the price, stamped. Without a price (it couldn't be priced, or the photo needs
 * another go) the tag stays off and the band says why.
 */
export function CaptureResultScene({
  photoUri,
  eyebrow,
  title,
  amountPhp,
  formatPrice,
  found = [],
  topInset = 0,
  onClose,
}: {
  readonly photoUri: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly amountPhp?: number;
  readonly formatPrice?: (amount: number) => string;
  readonly found?: readonly FoundSticker[];
  readonly topInset?: number;
  readonly onClose?: () => void;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const priced = amountPhp !== undefined && formatPrice !== undefined;
  const land = useSharedValue(reduceMotion ? 1 : 0);
  const stamp = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion || !priced) return;
    land.value = withSpring(1, tokens.motion.spring.playful);
    stamp.value = withDelay(520, withSpring(1, { damping: 12, stiffness: 260 }));
  }, [land, priced, reduceMotion, stamp]);

  const landStyle = useAnimatedStyle(() => ({
    opacity: interpolate(land.value, [0, 0.3, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(land.value, [0, 1], [-30, 0]) },
      { rotate: `${interpolate(land.value, [0, 1], [14, 6])}deg` },
    ],
  }));
  const stampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(stamp.value, [0, 0.4, 1], [0, 1, 1]),
    transform: [{ scale: interpolate(stamp.value, [0, 1], [2.1, 1]) }, { rotate: '-10deg' }],
  }));

  const stickers = found.slice(0, 2);
  return (
    <View style={styles.scene}>
      <SnapBand topInset={topInset} onClose={onClose}>
        <View style={styles.resultWords}>
          <SWText variant="stamp" color={colors.onPlaceFeed}>
            {eyebrow}
          </SWText>
          <SWText
            variant="displayMedium"
            color={colors.onPlaceFeed}
            style={styles.headline}
            accessibilityRole="header"
          >
            {title}
          </SWText>
        </View>
      </SnapBand>

      <View style={[styles.stage, { height: priced ? 290 : 250 }]}>
        <View style={[styles.printSlot, { left: 22, top: 8, transform: [{ rotate: '-4deg' }] }]}>
          <Print
            photoUri={photoUri}
            size={resultPhoto}
            label="Your captured photo"
            scanning={false}
          />
        </View>
        {stickers[0] ? <Sticker {...stickers[0]} tilt={-3} style={{ left: 168, top: 0 }} /> : null}
        {stickers[1] ? <Sticker {...stickers[1]} tilt={2} style={{ left: 0, top: 108 }} /> : null}
        {priced ? (
          <Animated.View style={[styles.tagSlot, { left: 148, top: 150 }, landStyle]}>
            <PriceTag amountPhp={amountPhp} formatPrice={formatPrice} />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.stamp,
                { borderColor: colors.accent, backgroundColor: colors.canvas },
                stampStyle,
              ]}
            >
              <SWText variant="stamp" color={colors.accent} style={styles.stampText}>
                PRICED
              </SWText>
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Where the estimate sits in its likely range, as a ruler: the marigold span is the range, the red
 * mark the estimate, with room either side so the span reads as a part of the scale.
 */
export function EstimateRange({
  lowPhp,
  highPhp,
  amountPhp,
  formatPrice,
}: {
  readonly lowPhp: number;
  readonly highPhp: number;
  readonly amountPhp: number;
  readonly formatPrice: (amount: number) => string;
}) {
  const { colors } = useTheme();
  const span = Math.max(1, highPhp - lowPhp);
  const min = lowPhp - span * 0.3;
  const max = highPhp + span * 0.3;
  const at = (value: number) =>
    `${((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100}%` as const;
  return (
    <View
      style={styles.range}
      accessible
      accessibilityLabel={`Likely ${formatPrice(lowPhp)} to ${formatPrice(highPhp)}, estimate ${formatPrice(amountPhp)}. A rough AI guess.`}
    >
      <View style={styles.rangeHead}>
        <SWText variant="stamp" color={colors.textMuted}>
          LIKELY
        </SWText>
        <SWText variant="stamp" color={colors.textMuted}>
          A ROUGH AI GUESS
        </SWText>
      </View>
      <View style={[styles.track, { backgroundColor: colors.sand, borderColor: colors.heldEdge }]}>
        <View
          style={[
            styles.span,
            {
              left: at(lowPhp),
              right: `${100 - parseFloat(at(highPhp))}%`,
              backgroundColor: colors.marigold,
              borderColor: colors.heldEdge,
            },
          ]}
        />
        <View
          style={[
            styles.mark,
            { left: at(amountPhp), backgroundColor: colors.accent, borderColor: colors.heldEdge },
          ]}
        />
      </View>
      <View style={styles.rangeHead}>
        <SWText variant="priceSmall" color={colors.textPrimary}>
          {formatPrice(lowPhp)}
        </SWText>
        <SWText variant="priceSmall" color={colors.textPrimary}>
          {formatPrice(highPhp)}
        </SWText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    gap: tokens.spacing[5],
  },
  band: {
    paddingHorizontal: tokens.spacing[5],
    paddingBottom: tokens.spacing[6],
    gap: tokens.spacing[4],
  },
  bandTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scallops: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -10,
    height: 20,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  scallop: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spacing[3],
  },
  headline: {
    flex: 1,
  },
  resultWords: {
    gap: tokens.spacing[1],
  },
  stage: {
    width: stageWidth,
    alignSelf: 'center',
    marginTop: tokens.spacing[3],
  },
  printSlot: {
    position: 'absolute',
  },
  printFrame: {
    padding: 2,
    borderRadius: 8,
  },
  print: {
    padding: 10,
    paddingBottom: 30,
    borderRadius: 6,
  },
  photoWindow: {
    borderRadius: 3,
    overflow: 'hidden',
  },
  loupe: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: loupeSize,
    height: loupeSize,
    borderRadius: loupeSize / 2,
    borderWidth: 3,
    overflow: 'hidden',
  },
  sticker: {
    position: 'absolute',
    maxWidth: 170,
    paddingHorizontal: tokens.spacing[2] + 2,
    paddingVertical: tokens.spacing[1] + 1,
    borderRadius: 10,
  },
  string: {
    position: 'absolute',
    width: 2,
    transformOrigin: 'top',
  },
  tagSlot: {
    position: 'absolute',
    transformOrigin: 'left top',
  },
  tag: {
    width: 196,
    height: 100,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    justifyContent: 'center',
    paddingLeft: 34,
    gap: 2,
  },
  eyelet: {
    position: 'absolute',
    left: 11,
    top: 43,
    width: 12,
    height: 12,
    borderRadius: 7,
    borderWidth: 2,
  },
  tagHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  wheels: {
    flexDirection: 'row',
    alignItems: 'center',
    height: digitHeight,
    overflow: 'hidden',
  },
  wheel: {
    height: digitHeight,
    overflow: 'hidden',
  },
  commaCell: {
    height: digitHeight,
    justifyContent: 'center',
  },
  // Every digit in a box of the same size, so the wheels line up with the still ₱ and 0 as they
  // roll, and the tag doesn't change width as different digits pass.
  digitCell: {
    height: digitHeight,
    minWidth: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stamp: {
    position: 'absolute',
    left: 66,
    top: 80,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 3,
    borderRadius: 6,
  },
  stampText: {
    fontSize: 14,
    letterSpacing: 2,
  },
  range: {
    gap: tokens.spacing[2],
  },
  rangeHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  track: {
    height: 18,
    borderRadius: 6,
    borderWidth: 2,
  },
  span: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderRadius: 3,
    borderWidth: 1.5,
  },
  mark: {
    position: 'absolute',
    top: -8,
    width: 4,
    height: 30,
    marginLeft: -2,
    borderRadius: 2,
    borderWidth: 1.5,
  },
});
