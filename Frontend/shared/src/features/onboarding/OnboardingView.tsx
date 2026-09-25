import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  EstimateBadge,
  Photo,
  PriceRangeBar,
  Reveal,
  SWText,
  VerdictBar,
  VoteChips,
} from '../../components';
import {
  haptic,
  themedStyles,
  tokens,
  useMotionPreference,
  useTheme,
  useThemedStyles,
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

interface Step {
  readonly key: string;
  readonly chapter: string;
  readonly title: string;
  readonly body: string;
  readonly illustration: (active: boolean) => ReactNode;
}

const cameraListing = previewListings[0];
const votedPost = previewPosts[0];

const bracketCorners = [
  { key: 'topLeft', x: -1, y: -1 },
  { key: 'topRight', x: 1, y: -1 },
  { key: 'bottomLeft', x: -1, y: 1 },
  { key: 'bottomRight', x: 1, y: 1 },
] as const;

/** Step 1: a demo scan — a sweeping line and settling brackets, the same mark the launch screen draws. */
function SnapIllustration({ active }: { readonly active: boolean }) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const settle = useSharedValue(reduceMotion ? 1 : 0);
  const scan = useSharedValue(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    settle.value = reduceMotion ? 1 : active ? withTiming(1, { duration: 560 }) : 0;
  }, [active, reduceMotion, settle]);

  useEffect(() => {
    if (!active || reduceMotion || height === 0) {
      cancelAnimation(scan);
      scan.value = 0;
      return;
    }
    scan.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(scan);
  }, [active, height, reduceMotion, scan]);

  const scanStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scan.value, [0, 0.06, 0.9, 1], [0, 1, 1, 0]),
    transform: [{ translateY: interpolate(scan.value, [0, 1], [0, height]) }],
  }));

  return (
    <View style={styles.illustration}>
      {cameraListing ? (
        <Photo
          source={cameraListing.photo}
          label={cameraListing.photoLabel}
          radius={tokens.radius.large}
          style={styles.photoFill}
        />
      ) : null}
      <View
        style={styles.viewfinder}
        pointerEvents="none"
        onLayout={(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height)}
      >
        {height > 0 ? (
          <Animated.View style={[styles.scanLine, { backgroundColor: colors.accent }, scanStyle]} />
        ) : null}
        {bracketCorners.map((corner) => (
          <Bracket key={corner.key} corner={corner} settle={settle} />
        ))}
      </View>
    </View>
  );
}

function Bracket({
  corner,
  settle,
}: {
  readonly corner: (typeof bracketCorners)[number];
  readonly settle: SharedValue<number>;
}) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => ({
    opacity: settle.value,
    transform: [
      { translateX: (1 - settle.value) * tokens.spacing[4] * corner.x },
      { translateY: (1 - settle.value) * tokens.spacing[4] * corner.y },
    ],
  }));
  return (
    <Animated.View
      style={[styles.bracket, styles[corner.key], { borderColor: colors.accent }, style]}
    />
  );
}

/** Step 2: the photo resolves into a range, always shown with its confidence, never one bare number. */
function EstimateIllustration() {
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={styles.illustration}>
      <Photo
        source={previewItem.photo}
        label={previewItem.photoLabel}
        radius={tokens.radius.large}
        style={styles.photoFill}
      />
      <View style={[styles.anchor, styles.panel]}>
        <EstimateBadge
          value={`${formatPeso(previewValuation.low)} – ${formatPeso(previewValuation.high)}`}
          size="compact"
        />
        <PriceRangeBar
          low={previewValuation.low}
          high={previewValuation.high}
          estimate={Math.round((previewValuation.low + previewValuation.high) / 2)}
          confidence={previewValuation.confidence}
          format={formatPeso}
        />
      </View>
    </View>
  );
}

/** Step 3: the community weighs in; the seller still decides. */
function DecideIllustration() {
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={styles.illustration}>
      {votedPost ? (
        <>
          <Photo
            source={votedPost.photo}
            label={votedPost.photoLabel}
            radius={tokens.radius.large}
            style={styles.photoFill}
          />
          <View style={[styles.anchor, styles.panel]}>
            <SWText variant="overline" tone="textMuted">
              Community vote
            </SWText>
            <VoteChips tally={votedPost.votes} selected="just_right" />
            <VerdictBar tally={votedPost.votes} />
          </View>
        </>
      ) : null}
    </View>
  );
}

const steps: readonly Step[] = [
  {
    key: 'snap',
    chapter: '01 — Snap it',
    title: 'One photo. That’s it.',
    body: 'Point your camera at something you own. The photo is saved to your history first, so nothing is lost.',
    illustration: (active) => <SnapIllustration active={active} />,
  },
  {
    key: 'range',
    chapter: '02 — Know the range',
    title: 'See the likely range.',
    body: 'An AI estimate arrives in seconds, with a range and a confidence — never just one number pretending to be certain.',
    illustration: () => <EstimateIllustration />,
  },
  {
    key: 'decide',
    chapter: '03 — Sell or ask',
    title: 'Sell it, or ask the community.',
    body: 'List it at a price you set, or let people vote on whether it is fair. Either way, the call stays yours.',
    illustration: () => <DecideIllustration />,
  },
];

/**
 * First-run introduction: three short chapters that show the photo-to-price loop with the
 * product's own pieces, then hand off to account creation. Swipe or use Continue; skippable at
 * every step.
 */
export function OnboardingView({ onGetStarted, onSignIn, onSkip }: OnboardingViewProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(stylesFor);
  const { reduceMotion } = useMotionPreference();
  const pager = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const last = index === steps.length - 1;

  const onLayout = (event: LayoutChangeEvent) => setPageWidth(event.nativeEvent.layout.width);

  const advanceTo = (next: number) => {
    if (next === index) return;
    haptic('select');
    setIndex(next);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth === 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (next !== index && next >= 0 && next < steps.length) advanceTo(next);
  };

  const goTo = (next: number) => {
    pager.current?.scrollTo({ x: next * pageWidth, animated: !reduceMotion });
    advanceTo(next);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.column}>
        <Reveal index={0} style={styles.topBar}>
          <SWText variant="wordmark">SnapWorth</SWText>
          {last ? null : <Button label="Skip" variant="tertiary" onPress={onSkip} />}
        </Reveal>

        <Reveal index={1} style={styles.pagerArea}>
          <View style={styles.fill} onLayout={onLayout}>
            {pageWidth > 0 ? (
              <ScrollView
                ref={pager}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                style={styles.fill}
              >
                {steps.map((step, stepIndex) => (
                  <View
                    key={step.key}
                    style={[styles.page, { width: pageWidth }]}
                    accessibilityElementsHidden={stepIndex !== index}
                    importantForAccessibility={stepIndex === index ? 'auto' : 'no-hide-descendants'}
                  >
                    {step.illustration(stepIndex === index)}
                    <View style={styles.copy}>
                      <SWText variant="overline" tone="textMuted">
                        {step.chapter}
                      </SWText>
                      <SWText variant="displayHero" accessibilityRole="header">
                        {step.title}
                      </SWText>
                      <SWText variant="bodyLarge" tone="textSecondary">
                        {step.body}
                      </SWText>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        </Reveal>

        <Reveal index={2} style={styles.footer}>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${index + 1} of ${steps.length}`}
            accessibilityValue={{ min: 1, max: steps.length, now: index + 1 }}
            style={styles.progress}
          >
            {steps.map((step, stepIndex) => (
              <ProgressSegment key={step.key} done={stepIndex <= index} />
            ))}
          </View>
          <Button
            label={last ? 'Get started' : 'Continue'}
            onPress={last ? onGetStarted : () => goTo(index + 1)}
            accessibilityHint={last ? 'Creates your SnapWorth account' : undefined}
          />
          <Button label="I already have an account" variant="tertiary" onPress={onSignIn} />
        </Reveal>
      </View>
    </View>
  );
}

function ProgressSegment({ done }: { readonly done: boolean }) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(reduceMotion ? (done ? 1 : 0) : 0);

  useEffect(() => {
    fill.value = reduceMotion ? (done ? 1 : 0) : withTiming(done ? 1 : 0, { duration: 260 });
  }, [done, fill, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      fill.value,
      [0, 1],
      [colors.borderStrong, colors.textPrimary],
    ),
  }));

  return <Animated.View style={[styles.segment, style]} />;
}

const bracket = tokens.layout.viewfinderBracket;
const stroke = tokens.layout.progressSegment;
const gutter = tokens.layout.pageGutterCompact;

const stylesFor = themedStyles((colors) => ({
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
    minHeight: tokens.layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: gutter,
    paddingRight: gutter - tokens.spacing[2],
  },
  pagerArea: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: gutter,
    paddingTop: tokens.spacing[2],
    gap: tokens.spacing[8],
  },
  illustration: {
    flex: 1,
    minHeight: 0,
  },
  photoFill: {
    flex: 1,
  },
  viewfinder: {
    position: 'absolute',
    top: tokens.spacing[6],
    right: tokens.spacing[6],
    bottom: tokens.spacing[6],
    left: tokens.spacing[6],
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.9,
  },
  bracket: {
    position: 'absolute',
    width: bracket * 1.6,
    height: bracket * 1.6,
  },
  topLeft: { top: 0, left: 0, borderTopWidth: stroke, borderLeftWidth: stroke },
  topRight: { top: 0, right: 0, borderTopWidth: stroke, borderRightWidth: stroke },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: stroke, borderLeftWidth: stroke },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: stroke, borderRightWidth: stroke },
  anchor: {
    position: 'absolute',
    left: tokens.spacing[4],
    right: tokens.spacing[4],
    bottom: tokens.spacing[4],
  },
  panel: {
    gap: tokens.spacing[2],
    padding: tokens.spacing[3],
    borderRadius: tokens.radius.medium,
    backgroundColor: colors.surface,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderSubtle,
  },
  copy: {
    gap: tokens.spacing[3],
  },
  footer: {
    paddingHorizontal: gutter,
    paddingTop: tokens.spacing[6],
    paddingBottom: tokens.spacing[2],
    gap: tokens.spacing[3],
  },
  progress: {
    flexDirection: 'row',
    gap: tokens.spacing[2],
    marginBottom: tokens.spacing[3],
  },
  segment: {
    flex: 1,
    height: stroke,
    borderRadius: tokens.radius.full,
  },
}));
