import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOutUp,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AiFoil, SWText, TagShape, Worthy } from '../../components';
import { held, tokens, useTheme } from '../../design';

export type EstimatingStage = 'looking' | 'estimating';

/** What Worthy says while he works, a line at a time. Nothing here claims a search it didn't do. */
const lines: Readonly<Record<EstimatingStage, readonly string[]>> = {
  looking: ['Checking the light and focus…', 'Reading any labels…', 'Finding the item in frame…'],
  estimating: [
    'Working out what it is…',
    'Looking at wear and condition…',
    'Weighing up the details…',
    'Putting a price on it…',
  ],
};

const headline: Readonly<Record<EstimatingStage, string>> = {
  looking: 'Looking at your photo',
  estimating: 'Pricing your item',
};

/**
 * The wait between the shutter and the estimate, told the way the app tells everything: the
 * photo lies on the table as a print with a scan line passing over it, Worthy hops beside it
 * thinking, and a kraft tag's digits roll like a price gun's until the real number arrives.
 * With Reduce Motion everything holds still and only the words change.
 */
export function EstimatingScene({
  photoUri,
  stage,
  looksLike,
}: {
  readonly photoUri: string;
  readonly stage: EstimatingStage;
  /** What the phone made of the item, once it knows. */
  readonly looksLike?: string;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scan = useSharedValue(0);
  const hop = useSharedValue(0);
  const [line, setLine] = useState(0);
  const [digits, setDigits] = useState('?,???');

  useEffect(() => {
    if (reduceMotion) return;
    scan.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    hop.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }),
        withTiming(0, { duration: 420 }),
      ),
      -1,
    );
    return () => {
      cancelAnimation(scan);
      cancelAnimation(hop);
    };
  }, [hop, reduceMotion, scan]);

  // A new line every couple of seconds, starting over when the stage changes.
  useEffect(() => {
    setLine(0);
    const timer = setInterval(
      () => setLine((current) => (current + 1) % lines[stage].length),
      2200,
    );
    return () => clearInterval(timer);
  }, [stage]);

  // The price gun's wheels, rolling while it works out the number.
  useEffect(() => {
    if (reduceMotion) return;
    const roll = () => {
      const digit = () => String(Math.floor(Math.random() * 10));
      setDigits(`${digit()},${digit()}${digit()}${digit()}`);
    };
    const timer = setInterval(roll, 110);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  const scanStyle = useAnimatedStyle(() => ({
    top: `${4 + scan.value * 88}%`,
  }));
  const hopStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -hop.value * 14 },
      { rotate: `${-4 + hop.value * 8}deg` },
      { scaleY: 1 - hop.value * 0.04 },
    ],
  }));

  return (
    <View style={styles.root} accessibilityLiveRegion="polite">
      <View style={styles.table}>
        {/* A print on the table: the cut-paper edge and hard shadow on the card, the photo and
            the scan line clipped inside it (clipping the card would clip its shadow on iOS). */}
        <View style={[styles.print, held(colors, 4)]}>
          <View style={styles.window}>
            <Image
              source={{ uri: photoUri }}
              accessibilityLabel="Your photo"
              resizeMode="cover"
              style={styles.photo}
            />
            {reduceMotion ? null : (
              <Animated.View pointerEvents="none" style={[styles.scan, scanStyle]}>
                <View style={[styles.scanGlow, { backgroundColor: colors.marigold }]} />
                <View style={[styles.scanLine, { backgroundColor: colors.marigold }]} />
              </Animated.View>
            )}
          </View>
        </View>
        <View style={styles.tag}>
          <TagShape hanging tilt={8} swing>
            <AiFoil size="small" />
            <SWText variant="priceSmall" color={colors.kraftInk}>
              {`₱${reduceMotion ? '?,???' : digits}`}
            </SWText>
          </TagShape>
        </View>
        <Animated.View style={[styles.worthy, hopStyle]}>
          <Worthy size={78} mood="thinking" />
        </Animated.View>
      </View>

      <View style={styles.words}>
        <SWText variant="headingLarge" color={tokens.overlay.text} align="center">
          {headline[stage]}
        </SWText>
        <View style={styles.lineRow}>
          <Animated.View
            key={`${stage}-${line}`}
            entering={FadeInDown.duration(260)}
            exiting={FadeOutUp.duration(180)}
          >
            <SWText variant="bodyMedium" color={tokens.overlay.text} align="center">
              {lines[stage][line]}
            </SWText>
          </Animated.View>
        </View>
        {looksLike ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.looks}>
            <SWText variant="labelSmall" color={tokens.overlay.text}>
              {`Looks like: ${looksLike}`}
            </SWText>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const printWidth = 210;

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: tokens.spacing[6],
    paddingTop: tokens.spacing[4],
  },
  table: {
    width: printWidth + 96,
    height: printWidth * 1.18 + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  print: {
    width: printWidth,
    aspectRatio: 0.86,
    padding: 8,
    paddingBottom: 26,
    borderRadius: tokens.radius.small,
    backgroundColor: tokens.illustration.cardStock,
    transform: [{ rotate: '-3deg' }],
  },
  window: {
    flex: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  photo: {
    flex: 1,
  },
  scan: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 18,
    marginTop: -9,
    justifyContent: 'center',
  },
  scanGlow: {
    ...StyleSheet.absoluteFill,
    opacity: 0.22,
    borderRadius: 9,
  },
  scanLine: {
    height: 2.5,
    borderRadius: 2,
  },
  tag: {
    position: 'absolute',
    top: 2,
    right: 0,
  },
  worthy: {
    position: 'absolute',
    bottom: 0,
    left: 6,
  },
  words: {
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[4],
  },
  lineRow: {
    minHeight: 24,
    justifyContent: 'center',
  },
  looks: {
    marginTop: tokens.spacing[1],
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[1] + 2,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.overlay.chrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.overlay.border,
  },
});
