import { ArrowDown, ArrowUp, Check, Sparkles, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  interpolateColor,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AmbientBackdrop,
  CountUp,
  Photo,
  PressableScale,
  Reveal,
  Sparkline,
  SWText,
  Tag,
} from '../../components';
import {
  haptic,
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  type SemanticColorName,
} from '../../design';
import {
  formatPeso,
  previewItem,
  previewListings,
  previewPosts,
  previewValuation,
} from '../preview/sample-data';

export interface OnboardingViewProps {
  /** The last step's primary action: start a new account. */
  readonly onGetStarted?: () => void;
  /** For returning users on any step. */
  readonly onSignIn?: () => void;
  /** Leaves the introduction early. */
  readonly onSkip?: () => void;
}

const steps = [
  { key: 'snap', title: 'Snap anything.', body: 'One photo is all it takes.' },
  { key: 'worth', title: 'Know its worth.', body: 'A fair range in seconds, not a guess.' },
  { key: 'decide', title: 'Sell, or ask.', body: 'List it, or let the community weigh in.' },
] as const;

const lastIndex = steps.length - 1;
const copyHeight = 124;
const glideMs = 820;
const curve = tokens.motion.bezier.expressive;
const expressive = Easing.bezier(curve[0] ?? 0, curve[1] ?? 0, curve[2] ?? 1, curve[3] ?? 1);
const clamp = Extrapolation.CLAMP;

/** Other things people value, drifting behind the hero on the first step: "anything". */
const satellites = previewListings.slice(0, 4).map((listing, slot) => ({
  key: listing.id,
  photo: listing.photo,
  label: listing.photoLabel,
  x: [-0.4, 0.41, -0.42, 0.4][slot] ?? 0,
  y: [-0.33, -0.2, 0.2, 0.34][slot] ?? 0,
  tilt: [-12, 10, 8, -9][slot] ?? 0,
  phase: slot * 0.23,
}));

const votes = previewPosts[0]?.votes ?? { too_high: 0, just_right: 0, too_low: 0 };

interface Bubble {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly icon: LucideIcon;
  readonly tone: SemanticColorName;
  /** Resting place on the last step, as a share of the stage from its centre. */
  readonly x: number;
  readonly y: number;
}

const bubbles: readonly Bubble[] = [
  {
    key: 'just_right',
    label: 'Just right',
    count: votes.just_right,
    icon: Check,
    tone: 'success',
    x: 0.2,
    y: -0.24,
  },
  {
    key: 'too_high',
    label: 'Too high',
    count: votes.too_high,
    icon: ArrowUp,
    tone: 'textSecondary',
    x: 0.27,
    y: -0.04,
  },
  {
    key: 'too_low',
    label: 'Too low',
    count: votes.too_low,
    icon: ArrowDown,
    tone: 'textSecondary',
    x: 0.19,
    y: 0.15,
  },
];

/**
 * First-run introduction, told as one continuous scene rather than three slides. A single item
 * travels through it: it is framed and recognised, lifts to reveal its fair range, then tilts
 * aside as the community's votes arrive. Every layer is a function of the pager's offset on the
 * UI thread, so a swipe scrubs the story under the finger and Continue plays the same path.
 */
export function OnboardingView({ onGetStarted, onSignIn, onSkip }: OnboardingViewProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const pager = useAnimatedRef<Animated.ScrollView>();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [index, setIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const glide = useSharedValue(0);
  const gliding = useSharedValue(false);
  const settled = useSharedValue(0);
  const idle = useSharedValue(0);
  const width = size.width;

  useEffect(() => {
    if (reduceMotion) return;
    idle.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(idle);
  }, [idle, reduceMotion]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: nextWidth, height } = event.nativeEvent.layout;
    setSize({ width: nextWidth, height });
  };

  const land = (next: number) => {
    haptic('select');
    setIndex(next);
  };

  const onScroll = useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        scrollX.value = event.contentOffset.x;
        if (width === 0) return;
        const page = Math.min(lastIndex, Math.max(0, Math.round(event.contentOffset.x / width)));
        if (page !== settled.value) {
          settled.value = page;
          runOnJS(land)(page);
        }
      },
      onBeginDrag: () => {
        // A finger always wins: catching the scene mid-glide hands it straight to the swipe.
        if (gliding.value) {
          cancelAnimation(glide);
          gliding.value = false;
        }
      },
    },
    [width],
  );

  useAnimatedReaction(
    () => glide.value,
    (x) => {
      if (gliding.value) scrollTo(pager, x, 0, false);
    },
  );

  const advance = () => {
    if (width === 0) return;
    // Read the page from the offset, not React state, so a tap mid-glide still aims correctly.
    const current = Math.min(lastIndex, Math.max(0, Math.round(scrollX.value / width)));
    if (current >= lastIndex) {
      onGetStarted?.();
      return;
    }
    const target = (current + 1) * width;
    if (reduceMotion) {
      scrollTo(pager, target, 0, false);
      return;
    }
    cancelAnimation(glide);
    glide.value = scrollX.value;
    gliding.value = true;
    glide.value = withTiming(target, { duration: glideMs, easing: expressive }, () => {
      gliding.value = false;
    });
  };

  const last = index === lastIndex;
  const stageHeight = Math.max(0, size.height - copyHeight);

  const skipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value / Math.max(width, 1), [1, 2], [1, 0], clamp),
  }));
  const continueStyle = useAnimatedStyle(() => {
    const t = interpolate(scrollX.value / Math.max(width, 1), [1, 2], [0, 1], clamp);
    return { opacity: 1 - t * 1.6, transform: [{ translateY: -t * 12 }] };
  });
  const startStyle = useAnimatedStyle(() => {
    const t = interpolate(scrollX.value / Math.max(width, 1), [1, 2], [0, 1], clamp);
    return { opacity: t * 1.6 - 0.6, transform: [{ translateY: (1 - t) * 12 }] };
  });

  return (
    <View style={styles.root}>
      <AmbientBackdrop mood="value" />
      <View style={[styles.column, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Reveal index={0} style={styles.topBar}>
          <SWText variant="wordmark">SnapWorth</SWText>
          <Animated.View style={skipStyle} pointerEvents={last ? 'none' : 'auto'}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Skip the introduction"
              onPress={onSkip}
              hitSlop={tokens.spacing[2]}
              style={styles.skip}
            >
              <SWText variant="label" tone="textSecondary">
                Skip
              </SWText>
            </PressableScale>
          </Animated.View>
        </Reveal>

        <View style={styles.fill} onLayout={onLayout}>
          {width > 0 && stageHeight > 0 ? (
            <>
              <Reveal index={1} style={[styles.stage, { height: stageHeight }]}>
                <Stage
                  progress={scrollX}
                  idle={idle}
                  width={width}
                  height={stageHeight}
                  index={index}
                  reduceMotion={reduceMotion}
                />
              </Reveal>
              <Animated.ScrollView
                ref={pager}
                horizontal
                pagingEnabled
                bounces={false}
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                style={styles.pager}
              >
                {steps.map((step, stepIndex) => (
                  <Copy
                    key={step.key}
                    title={step.title}
                    body={step.body}
                    index={stepIndex}
                    active={stepIndex === index}
                    scrollX={scrollX}
                    width={width}
                    reduceMotion={reduceMotion}
                  />
                ))}
              </Animated.ScrollView>
            </>
          ) : null}
        </View>

        <Reveal index={2} style={styles.footer}>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${index + 1} of ${steps.length}`}
            accessibilityValue={{ min: 1, max: steps.length, now: index + 1 }}
            style={styles.dots}
          >
            {steps.map((step, stepIndex) => (
              <Dot key={step.key} index={stepIndex} scrollX={scrollX} width={width} />
            ))}
          </View>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={last ? 'Get started' : 'Continue'}
            accessibilityHint={last ? 'Creates your SnapWorth account' : undefined}
            haptic={last ? 'pop' : 'tap'}
            onPress={advance}
            style={({ pressed }) => [styles.primary, pressed ? styles.primaryPressed : null]}
          >
            <Animated.View style={[styles.primaryLabel, continueStyle]}>
              <SWText variant="button" tone="onInverse">
                Continue
              </SWText>
            </Animated.View>
            <Animated.View style={[styles.primaryLabel, startStyle]}>
              <SWText variant="button" tone="onInverse">
                Get started
              </SWText>
            </Animated.View>
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="I already have an account. Sign in"
            haptic="none"
            onPress={onSignIn}
            style={styles.signIn}
          >
            <SWText variant="bodyMedium" tone="textSecondary">
              Have an account?{' '}
              <SWText variant="label" tone="textPrimary">
                Sign in
              </SWText>
            </SWText>
          </PressableScale>
        </Reveal>
      </View>
    </View>
  );
}

interface StageProps {
  readonly progress: SharedValue<number>;
  readonly idle: SharedValue<number>;
  readonly width: number;
  readonly height: number;
  readonly index: number;
  readonly reduceMotion: boolean;
}

/** The scene behind the pager. `progress` is the raw scroll offset; pages are `width` apart. */
function Stage({ progress, idle, width, height, index, reduceMotion }: StageProps) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const cardWidth = Math.min(width * 0.56, height * 0.5);
  const cardHeight = cardWidth * 1.25;
  const lift = height * 0.1;
  const heroBottomOnRange = -lift + (cardHeight * 0.78) / 2;

  // Replay the range's count and trend line each time the second step is reached.
  const [rangeRun, setRangeRun] = useState(0);
  useEffect(() => {
    if (index === 1) setRangeRun((run) => run + 1);
  }, [index]);

  const heroStyle = useAnimatedStyle(() => {
    const p = progress.value / width;
    const bob = reduceMotion ? 0 : Math.sin(idle.value * Math.PI * 2) * 5;
    return {
      transform: [
        { translateX: interpolate(p, [0, 1, 2], [0, 0, -width * 0.14], clamp) },
        { translateY: interpolate(p, [0, 1, 2], [0, -lift, -height * 0.04], clamp) + bob },
        { scale: interpolate(p, [0, 1, 2], [1, 0.78, 0.8], clamp) },
        { rotateZ: `${interpolate(p, [0, 1, 2], [0, 0, -7], clamp)}deg` },
      ],
    };
  });

  const finderStyle = useAnimatedStyle(() => {
    const p = progress.value / width;
    return {
      opacity: interpolate(p, [0, 0.5], [1, 0], clamp),
      transform: [{ scale: interpolate(p, [0, 0.5], [1, 1.12], clamp) }],
    };
  });

  const detectStyle = useAnimatedStyle(() => {
    const p = progress.value / width;
    return {
      opacity: interpolate(p, [0, 0.35], [1, 0], clamp),
      transform: [{ translateY: interpolate(p, [0, 0.35], [0, 16], clamp) }],
    };
  });

  const rangeStyle = useAnimatedStyle(() => {
    const p = progress.value / width;
    return {
      opacity: interpolate(p, [0.3, 1, 1.55], [0, 1, 0], clamp),
      transform: [
        { translateX: interpolate(p, [1, 2], [0, -width * 0.45], clamp) },
        { translateY: interpolate(p, [0, 1], [72, 0], clamp) },
        { scale: interpolate(p, [0.3, 1, 2], [0.92, 1, 0.9], clamp) },
      ],
    };
  });

  const priceStyle = useAnimatedStyle(() => {
    const p = progress.value / width;
    return {
      opacity: interpolate(p, [1.5, 2], [0, 1], clamp),
      transform: [
        { translateY: interpolate(p, [1.5, 2], [24, 0], clamp) },
        { rotateZ: `${interpolate(p, [1.5, 2], [0, -4], clamp)}deg` },
      ],
    };
  });

  return (
    <View
      style={styles.stageInner}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {satellites.map((satellite) => (
        <Satellite
          key={satellite.key}
          satellite={satellite}
          progress={progress}
          idle={idle}
          width={width}
          height={height}
          size={cardWidth * 0.36}
          reduceMotion={reduceMotion}
        />
      ))}

      <Animated.View style={[{ width: cardWidth, height: cardHeight }, heroStyle]}>
        <View style={styles.hero}>
          <Photo
            source={previewItem.photo}
            label={previewItem.photoLabel}
            radius={tokens.radius.xlarge}
            style={styles.photo}
          />
          <Scan progress={progress} width={width} height={cardHeight} active={index === 0} />
        </View>
        <Animated.View style={[styles.finder, finderStyle]}>
          {bracketCorners.map((corner) => (
            <View key={corner} style={[styles.bracket, styles[corner]]} />
          ))}
        </Animated.View>
        <Animated.View style={[styles.float, styles.detect, detectStyle]}>
          <View style={styles.detectIcon}>
            <Sparkles size={14} strokeWidth={2.2} color={colors.accent} />
          </View>
          <SWText variant="labelSmall">Nike windbreaker</SWText>
          <SWText variant="caption" tone="textMuted">
            90s
          </SWText>
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[
          styles.float,
          styles.range,
          { top: height / 2 + heroBottomOnRange - tokens.spacing[4] },
          rangeStyle,
        ]}
      >
        <View style={styles.rangeHead}>
          <SWText variant="overline" tone="textMuted">
            Fair range
          </SWText>
          <Tag label={previewValuation.trendChange.split(' ')[0] ?? ''} tone="success" />
        </View>
        <View style={styles.rangeRow} key={`range-${rangeRun}`}>
          <CountUp variant="priceLarge" value={previewValuation.low} format={formatPeso} />
          <SWText variant="priceLarge" tone="textMuted">
            –
          </SWText>
          <CountUp
            variant="priceLarge"
            value={previewValuation.high}
            format={formatPeso}
            delayMs={80}
          />
        </View>
        <View key={`trend-${rangeRun}`}>
          <Sparkline values={previewValuation.trend} height={40} />
        </View>
      </Animated.View>

      {bubbles.map((bubble, slot) => (
        <VoteBubble
          key={bubble.key}
          bubble={bubble}
          slot={slot}
          progress={progress}
          idle={idle}
          width={width}
          height={height}
          reduceMotion={reduceMotion}
        />
      ))}

      <Animated.View
        style={[
          styles.float,
          styles.priceTag,
          { top: height / 2 + cardHeight * 0.34, left: width / 2 - cardWidth * 0.62 },
          priceStyle,
        ]}
      >
        <SWText variant="caption" tone="textMuted">
          Listed at
        </SWText>
        <SWText variant="priceSmall">{formatPeso(previewItem.estimate)}</SWText>
      </Animated.View>
    </View>
  );
}

function Satellite({
  satellite,
  progress,
  idle,
  width,
  height,
  size,
  reduceMotion,
}: {
  readonly satellite: (typeof satellites)[number];
  readonly progress: SharedValue<number>;
  readonly idle: SharedValue<number>;
  readonly width: number;
  readonly height: number;
  readonly size: number;
  readonly reduceMotion: boolean;
}) {
  const styles = useThemedStyles(stylesFor);
  const style = useAnimatedStyle(() => {
    const p = progress.value / width;
    const out = interpolate(p, [0, 0.8], [1, 1.7], clamp);
    const bob = reduceMotion ? 0 : Math.sin((idle.value + satellite.phase) * Math.PI * 2) * 7;
    return {
      opacity: interpolate(p, [0, 0.6], [1, 0], clamp),
      transform: [
        { translateX: satellite.x * width * out },
        { translateY: satellite.y * height * out + bob },
        { rotateZ: `${satellite.tilt * interpolate(p, [0, 0.8], [1, 1.6], clamp)}deg` },
        { scale: interpolate(p, [0, 0.8], [1, 0.8], clamp) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.satellite, { width: size, height: size * 1.25 }, style]}>
      <Photo source={satellite.photo} label={satellite.label} style={styles.photo} />
    </Animated.View>
  );
}

function VoteBubble({
  bubble,
  slot,
  progress,
  idle,
  width,
  height,
  reduceMotion,
}: {
  readonly bubble: Bubble;
  readonly slot: number;
  readonly progress: SharedValue<number>;
  readonly idle: SharedValue<number>;
  readonly width: number;
  readonly height: number;
  readonly reduceMotion: boolean;
}) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const start = 1.2 + slot * 0.12;
  const style = useAnimatedStyle(() => {
    const p = progress.value / width;
    const t = interpolate(p, [start, 2], [0, 1], clamp);
    const eased = 1 - Math.pow(1 - t, 3);
    const bob = reduceMotion ? 0 : Math.sin((idle.value + slot * 0.31) * Math.PI * 2) * 4;
    return {
      opacity: t,
      transform: [
        { translateX: bubble.x * width + (1 - eased) * width * 0.5 },
        { translateY: bubble.y * height + bob },
        { scale: 0.7 + eased * 0.3 },
      ],
    };
  });
  const Icon = bubble.icon;
  return (
    <Animated.View style={[styles.float, styles.bubble, style]}>
      <Icon size={14} strokeWidth={2.4} color={colors[bubble.tone]} />
      <SWText variant="labelSmall" tone={bubble.tone === 'success' ? 'success' : 'textPrimary'}>
        {bubble.label}
      </SWText>
      <SWText variant="labelSmall" tone="textMuted">
        {bubble.count}
      </SWText>
    </Animated.View>
  );
}

/** A thin line of light that sweeps the photo while the first step is framing it. */
function Scan({
  progress,
  width,
  height,
  active,
}: {
  readonly progress: SharedValue<number>;
  readonly width: number;
  readonly height: number;
  readonly active: boolean;
}) {
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(sweep);
      sweep.value = 0;
      return;
    }
    sweep.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(sweep);
  }, [active, reduceMotion, sweep]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value / width, [0, 0.4], [1, 0], clamp),
    transform: [{ translateY: interpolate(sweep.value, [0, 1], [height * 0.08, height * 0.86]) }],
  }));

  if (reduceMotion) return null;
  return <Animated.View style={[styles.scan, style]} />;
}

function Copy({
  title,
  body,
  index,
  active,
  scrollX,
  width,
  reduceMotion,
}: {
  readonly title: string;
  readonly body: string;
  readonly index: number;
  readonly active: boolean;
  readonly scrollX: SharedValue<number>;
  readonly width: number;
  readonly reduceMotion: boolean;
}) {
  const styles = useThemedStyles(stylesFor);
  const k = reduceMotion ? 0 : 1;
  const titleStyle = useAnimatedStyle(() => {
    const p = scrollX.value / width - index;
    return {
      opacity: interpolate(Math.abs(p), [0, 0.55], [1, 0], clamp),
      transform: [{ translateX: p * width * 0.4 * k }],
    };
  });
  const bodyStyle = useAnimatedStyle(() => {
    const p = scrollX.value / width - index;
    return {
      opacity: interpolate(Math.abs(p), [0, 0.4], [1, 0], clamp),
      transform: [{ translateX: p * width * 0.6 * k }],
    };
  });
  return (
    <View
      style={[styles.page, { width }]}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      <View style={styles.copy}>
        <Animated.View style={titleStyle}>
          <SWText variant="displayHero" accessibilityRole="header" style={styles.center}>
            {title}
          </SWText>
        </Animated.View>
        <Animated.View style={bodyStyle}>
          <SWText variant="bodyLarge" tone="textSecondary" style={styles.center}>
            {body}
          </SWText>
        </Animated.View>
      </View>
    </View>
  );
}

function Dot({
  index,
  scrollX,
  width,
}: {
  readonly index: number;
  readonly scrollX: SharedValue<number>;
  readonly width: number;
}) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const near = width > 0 ? Math.max(0, 1 - Math.abs(scrollX.value / width - index)) : 0;
    return {
      width: interpolate(near, [0, 1], [dot, dot * 3.4]),
      backgroundColor: interpolateColor(near, [0, 1], [colors.borderStrong, colors.textPrimary]),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const bracketCorners = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;

const dot = 7;
const bracket = tokens.layout.viewfinderBracket * 1.3;
const stroke = tokens.layout.progressSegment;
const gutter = tokens.layout.pageGutterCompact;
const finderGap = tokens.spacing[3];

const stylesFor = themedStyles((colors, name) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: tokens.layout.phoneColumn,
    alignSelf: 'center',
  },
  fill: {
    flex: 1,
  },
  topBar: {
    minHeight: tokens.layout.headerCompact,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    zIndex: 2,
  },
  skip: {
    paddingVertical: tokens.spacing[2],
    paddingLeft: tokens.spacing[3],
  },
  stage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  stageInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pager: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  page: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  hero: {
    flex: 1,
    borderRadius: tokens.radius.xlarge,
    backgroundColor: colors.sunken,
    overflow: 'hidden',
    shadowColor: tokens.shadow[name],
    shadowOpacity: 1,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  satellite: {
    position: 'absolute',
    borderRadius: tokens.radius.large,
    overflow: 'hidden',
    backgroundColor: colors.sunken,
  },
  scan: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: tokens.overlay.text,
    shadowColor: colors.accent,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  finder: {
    position: 'absolute',
    top: -finderGap,
    right: -finderGap,
    bottom: -finderGap,
    left: -finderGap,
  },
  bracket: {
    position: 'absolute',
    width: bracket,
    height: bracket,
    borderColor: colors.accent,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: stroke,
    borderLeftWidth: stroke,
    borderTopLeftRadius: tokens.radius.medium,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: stroke,
    borderRightWidth: stroke,
    borderTopRightRadius: tokens.radius.medium,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: stroke,
    borderLeftWidth: stroke,
    borderBottomLeftRadius: tokens.radius.medium,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: stroke,
    borderRightWidth: stroke,
    borderBottomRightRadius: tokens.radius.medium,
  },
  float: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderSubtle,
    shadowColor: tokens.shadow[name],
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  detect: {
    bottom: -(tokens.spacing[12] + tokens.spacing[3]),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingVertical: tokens.spacing[2],
    paddingLeft: tokens.spacing[2],
    paddingRight: tokens.spacing[4],
    borderRadius: tokens.radius.full,
  },
  detectIcon: {
    width: 26,
    height: 26,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  range: {
    width: 290,
    alignSelf: 'center',
    gap: tokens.spacing[1],
    paddingTop: tokens.spacing[4],
    paddingHorizontal: tokens.spacing[4],
    paddingBottom: tokens.spacing[3],
    borderRadius: tokens.radius.xlarge,
  },
  rangeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: tokens.spacing[1],
    marginBottom: tokens.spacing[1],
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1] + 2,
    paddingVertical: tokens.spacing[2] + 2,
    paddingHorizontal: tokens.spacing[3] + 2,
    borderRadius: tokens.radius.full,
  },
  priceTag: {
    paddingVertical: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[3] + 2,
    borderRadius: tokens.radius.large,
  },
  copy: {
    height: copyHeight,
    paddingHorizontal: gutter,
    justifyContent: 'center',
    gap: tokens.spacing[2],
  },
  center: {
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: gutter,
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[2],
    gap: tokens.spacing[4],
  },
  dots: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: tokens.spacing[2] - 2,
    marginBottom: tokens.spacing[1],
  },
  dot: {
    height: dot,
    borderRadius: tokens.radius.full,
  },
  primary: {
    height: tokens.layout.controlHeight,
    borderRadius: tokens.radius.full,
    backgroundColor: colors.inverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: {
    backgroundColor: colors.inversePressed,
  },
  primaryLabel: {
    position: 'absolute',
  },
  signIn: {
    alignSelf: 'center',
    paddingVertical: tokens.spacing[2],
  },
}));
