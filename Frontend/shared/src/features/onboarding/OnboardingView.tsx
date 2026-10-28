import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark, PressableScale, Reveal, RevealGate, SWText, Wordmark } from '../../components';
import {
  haptic,
  held,
  placeColors,
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
} from '../../design';
import { PrintLayer } from '../../components/BackdropPrint';
import { Scene, Sheets, stage, type Arrival } from './OnboardingScene';
import { SnapShutter, shutterClosesAt, shutterOpensAfter } from './SnapShutter';

export interface OnboardingViewProps {
  /** The last step's primary action: start a new account. */
  readonly onGetStarted?: () => void;
  /** For returning users on any step. */
  readonly onSignIn?: () => void;
  /** Leaves the introduction to browse as a guest; replay closes it instead. */
  readonly onSkip?: () => void;
  /**
   * `replay` is the introduction reopened from Settings by someone already signed in: it closes
   * instead of skipping, ends on Done, and has no sign-in line.
   */
  readonly mode?: 'first-run' | 'replay';
}

const steps = [
  {
    key: 'snap',
    title: 'Snap anything.',
    body: 'One photo is all it takes. SnapWorth works out what it is.',
  },
  {
    key: 'worth',
    title: 'Know its worth.',
    body: 'A fair range in seconds, from what things like it really sell for.',
  },
  {
    key: 'decide',
    title: 'Sell, or ask.',
    body: 'List it at a fair price, or let the community weigh in first.',
  },
] as const;

const lastIndex = steps.length - 1;
const curve = tokens.motion.bezier.expressive;
const expressive = Easing.bezier(curve[0] ?? 0, curve[1] ?? 0, curve[2] ?? 1, curve[3] ?? 1);
/** One spring for every move: firm, then soft, with nothing overshooting. */
const settleSpring = { stiffness: 80, damping: 2 * Math.sqrt(80), mass: 1 } as const;
/** Room the words, dots and buttons need under the scene. */
const copyRoom = 304;

const clamp = (v: number, a: number, b: number) => {
  'worklet';
  return Math.min(b, Math.max(a, v));
};

/**
 * First-run introduction: a cover, then three steps played as one continuous scene in the app's
 * own paper. Each step's colour block is laid over the last as you swipe; the jacket is snapped,
 * priced on a hanging tag, then voted on; people rise from behind the scalloped edge. One number,
 * the swipe position, drives all of it on the UI thread, so the scene follows the finger, and
 * one spring settles it. The card and the tag can be picked up and played with.
 */
export function OnboardingView({
  onGetStarted,
  onSignIn,
  onSkip,
  mode = 'first-run',
}: OnboardingViewProps) {
  const replay = mode === 'replay';
  const finishLabel = replay ? 'Done' : 'Create free account';
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(stylesFor);
  const { colors, name } = useTheme();
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const p = useSharedValue(0);
  const start = useSharedValue(0);
  const intro = useSharedValue(reduceMotion ? 1 : 0);
  const [index, setIndex] = useState(0);
  const [arrived, setArrived] = useState<Arrival>({ step: -1, run: 0, first: false });
  const runs = useRef(0);
  const reached = useRef(new Set<number>());
  const arrive = (step: number) => {
    runs.current += 1;
    const first = !reached.current.has(step);
    reached.current.add(step);
    setArrived({ step, run: runs.current, first });
  };
  // The introduction opens on its cover; the tour waits beneath until the cover rolls away.
  const [opened, setOpened] = useState(false);
  const [welcomed, setWelcomed] = useState(false);
  // Get started was pressed: the cover dives in and the shutter runs; the snap opens the tour.
  const [leaving, setLeaving] = useState(false);
  const beginSnap = () => {
    setLeaving(true);
    if (reduceMotion) snapped();
  };
  // The click: the cover is gone behind the shut iris. The first page comes alive as the iris
  // opens, so it arrives with the blades instead of waiting, finished, behind them.
  const snapped = () => {
    setWelcomed(true);
    setTimeout(() => setOpened(true), reduceMotion ? 0 : shutterOpensAfter);
  };

  const width = Math.min(size.width, tokens.layout.phoneColumn);
  const artTop = Math.max(0, insets.top - 40);
  const k = clamp(
    Math.min(width / stage.width, (size.height - copyRoom - insets.bottom - artTop) / stage.height),
    0.7,
    1.6,
  );
  const blockHeight = artTop + stage.edge * k;

  const settle = (step: number) => {
    if (step !== index) haptic('select');
    setIndex(step);
    arrive(step);
  };

  // The first page comes in as the cover lifts away: one entrance, not a finished page uncovered.
  useEffect(() => {
    if (!opened) return;
    intro.value = withTiming(1, { duration: reduceMotion ? 1 : 1000, easing: Easing.linear });
    arrive(0);
  }, [opened]);

  // Light status-bar text on the red and the cobalt, dark on the marigold.
  useEffect(() => {
    if (Platform.OS === 'web' || !welcomed) return;
    StatusBar.setBarStyle(index === 1 ? 'dark-content' : 'light-content', true);
  }, [index, welcomed]);

  const goTo = (target: number, velocity = 0) => {
    'worklet';
    const to = clamp(target, 0, lastIndex);
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) runOnJS(settle)(to);
    };
    p.value = reduceMotion
      ? withTiming(to, { duration: 260 }, done)
      : withSpring(to, { ...settleSpring, velocity }, done);
  };

  const pager = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-16, 16])
        .onStart(() => {
          cancelAnimation(p);
          start.value = p.value;
        })
        .onUpdate((event) => {
          let next = start.value - event.translationX / Math.max(width, 1);
          // Past either end the scene gives a little, like a page held at its edge.
          if (next < 0) next = -Math.pow(-next, 0.7) * 0.3;
          if (next > lastIndex) next = lastIndex + Math.pow(next - lastIndex, 0.7) * 0.3;
          p.value = next;
        })
        .onEnd((event) => {
          const velocity = -event.velocityX / Math.max(width, 1);
          const from = start.value;
          const aim = clamp(p.value + velocity * 0.16, Math.floor(from) - 1, Math.ceil(from) + 1);
          goTo(Math.round(aim), velocity);
        }),
    // goTo closes over settle, which reads the latest index through state.
    [width, reduceMotion, index],
  );

  const advance = () => {
    if (index >= lastIndex) {
      onGetStarted?.();
      return;
    }
    goTo(index + 1);
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setSize({ width: w, height: h });
  };

  const last = index === lastIndex;
  const nextStyle = useAnimatedStyle(() => {
    const t = interpolate(p.value, [1.5, 2], [0, 1], 'clamp');
    return { opacity: 1 - t * 1.6, transform: [{ translateY: -t * 10 }] };
  });
  // The camera pulling back from the photo just taken: the page settles from a little close.
  const pullStyle = useAnimatedStyle(() => {
    const t = 1 - Math.pow(1 - intro.value, 3);
    return { transform: [{ scale: 1 + 0.07 * (1 - t) }] };
  });
  const whyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [1.5, 2], [0, 1], 'clamp'),
  }));
  const firstLinksStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [1.5, 2], [1, 0], 'clamp'),
  }));
  const lastStyle = useAnimatedStyle(() => {
    const t = interpolate(p.value, [1.5, 2], [0, 1], 'clamp');
    return { opacity: t * 1.6 - 0.6, transform: [{ translateY: (1 - t) * 10 }] };
  });

  return (
    <View style={styles.root} onLayout={onLayout}>
      {/* The paper under the sheets, printed with the price gun's pesos and eyelets. */}
      {size.width > 0 ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { opacity: tokens.motion.ambient.printOpacity.full[name] },
          ]}
          pointerEvents="none"
        >
          <PrintLayer
            ink={colors.borderStrong}
            coverage="full"
            width={size.width}
            height={size.height}
          />
        </View>
      ) : null}
      {width > 0 ? (
        <GestureDetector gesture={pager}>
          <Animated.View style={[styles.column, { width }, pullStyle]}>
            <Sheets
              p={p}
              width={width}
              height={blockHeight}
              top={insets.top + tokens.spacing[1]}
              skipLabel={replay ? 'Close' : 'Skip'}
              intro={intro}
            />
            <View
              style={[styles.sceneSpot, { top: artTop, left: (width - stage.width * k) / 2 }]}
              pointerEvents="box-none"
            >
              <Scene
                p={p}
                k={k}
                arrived={arrived}
                reduceMotion={reduceMotion}
                pager={pager}
                intro={intro}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={replay ? 'Close the introduction' : 'Skip the introduction'}
              onPress={onSkip}
              hitSlop={tokens.spacing[2]}
              disabled={last && !replay}
              style={[styles.skipSpot, { top: insets.top }]}
            />

            <RevealGate open={opened}>
              <View
                style={[
                  styles.below,
                  {
                    top: blockHeight + tokens.spacing[4],
                    paddingBottom: insets.bottom + tokens.spacing[2],
                  },
                ]}
              >
                <Reveal index={0} style={styles.dots}>
                  <View
                    accessible
                    accessibilityRole="progressbar"
                    accessibilityLabel={`Step ${index + 1} of ${steps.length}`}
                    accessibilityValue={{ min: 1, max: steps.length, now: index + 1 }}
                    style={styles.dotRow}
                  >
                    {steps.map((step, stepIndex) => (
                      <Dot key={step.key} index={stepIndex} p={p} />
                    ))}
                  </View>
                </Reveal>
                <Reveal index={1} style={styles.copy}>
                  {steps.map((step, stepIndex) => (
                    <Copy
                      key={step.key}
                      title={step.title}
                      body={step.body}
                      index={stepIndex}
                      active={stepIndex === index}
                      p={p}
                    />
                  ))}
                </Reveal>
                <Reveal index={2} style={styles.actions}>
                  {/* Why an account, said where the choice is made: looking is free, acting isn't. */}
                  {replay ? null : (
                    <Animated.View
                      style={[styles.why, whyStyle]}
                      pointerEvents="none"
                      accessibilityElementsHidden={!last}
                      importantForAccessibility={last ? 'auto' : 'no-hide-descendants'}
                    >
                      <SWText variant="caption" tone="textSecondary" align="center">
                        Looking around is free. Snapping, voting and selling need a free account, so
                        every price here comes from a real person.
                      </SWText>
                    </Animated.View>
                  )}
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={last ? finishLabel : 'Continue'}
                    accessibilityHint={
                      last && !replay ? 'Creates your SnapWorth account' : undefined
                    }
                    haptic={last ? 'pop' : 'tap'}
                    onPress={advance}
                    style={({ pressed }) => [
                      styles.primary,
                      pressed ? styles.primaryPressed : null,
                    ]}
                  >
                    <Animated.View style={[styles.primaryLabel, nextStyle]}>
                      <SWText variant="button" tone="onAccent">
                        Continue
                      </SWText>
                    </Animated.View>
                    <Animated.View style={[styles.primaryLabel, lastStyle]}>
                      <SWText variant="button" tone="onAccent">
                        {finishLabel}
                      </SWText>
                    </Animated.View>
                  </PressableScale>
                  {replay ? (
                    <View style={styles.linkLine} />
                  ) : (
                    // Until the last step, the way in for returning people; on it, the way past the
                    // account for people who only want to look.
                    <View style={styles.linkLine}>
                      <Animated.View
                        style={[styles.linkRow, firstLinksStyle]}
                        pointerEvents={last ? 'none' : 'box-none'}
                      >
                        <SignInLink onSignIn={onSignIn} />
                      </Animated.View>
                      <Animated.View
                        style={[styles.linkRow, whyStyle]}
                        pointerEvents={last ? 'box-none' : 'none'}
                        accessibilityElementsHidden={!last}
                        importantForAccessibility={last ? 'auto' : 'no-hide-descendants'}
                      >
                        <PressableScale
                          accessibilityRole="button"
                          accessibilityLabel="Look around without an account"
                          haptic="none"
                          onPress={onSkip}
                          style={styles.signIn}
                        >
                          <SWText variant="label" tone="textPrimary">
                            Look around first
                          </SWText>
                        </PressableScale>
                        <SWText variant="bodyMedium" tone="textMuted">
                          ·
                        </SWText>
                        <SignInLink onSignIn={onSignIn} short />
                      </Animated.View>
                    </View>
                  )}
                </Reveal>
              </View>
            </RevealGate>
          </Animated.View>
        </GestureDetector>
      ) : null}
      {welcomed ? null : (
        <WelcomeCover
          leaving={leaving}
          onStart={beginSnap}
          onSignIn={replay ? undefined : onSignIn}
          onClose={replay ? onSkip : undefined}
        />
      )}
      {reduceMotion ? null : (
        <SnapShutter run={leaving} width={size.width} height={size.height} onSnap={snapped} />
      )}
    </View>
  );
}

function SignInLink({ onSignIn, short = false }: { onSignIn?: () => void; short?: boolean }) {
  const styles = useThemedStyles(stylesFor);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="I already have an account. Sign in"
      haptic="none"
      onPress={onSignIn}
      style={styles.signIn}
    >
      {short ? (
        <SWText variant="label" tone="textPrimary">
          Sign in
        </SWText>
      ) : (
        <SWText variant="bodyMedium" tone="textSecondary">
          Have an account?{' '}
          <SWText variant="label" tone="textPrimary">
            Sign in
          </SWText>
        </SWText>
      )}
    </PressableScale>
  );
}

/** A step's words: they sharpen into place as you arrive and fall away as you leave. */
function Copy({
  title,
  body,
  index,
  active,
  p,
}: {
  readonly title: string;
  readonly body: string;
  readonly index: number;
  readonly active: boolean;
  readonly p: SharedValue<number>;
}) {
  const styles = useThemedStyles(stylesFor);
  const style = useAnimatedStyle(() => {
    const a = Math.abs(p.value - index);
    return {
      opacity: clamp(1 - a * 1.9, 0, 1),
      transform: [{ translateY: a * 10 }, { scale: 1 - Math.min(a, 1) * 0.04 }],
    };
  });
  return (
    <Animated.View
      style={[styles.copyPage, style]}
      pointerEvents="none"
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      <SWText variant="displayMedium" align="center" accessibilityRole="header">
        {title}
      </SWText>
      <SWText variant="bodyLarge" tone="textSecondary" align="center" style={styles.body}>
        {body}
      </SWText>
    </Animated.View>
  );
}

function Dot({ index, p }: { readonly index: number; readonly p: SharedValue<number> }) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const near = Math.max(0, 1 - Math.abs(p.value - index));
    return {
      width: interpolate(near, [0, 1], [dot, dot * 3.4]),
      backgroundColor: interpolateColor(near, [0, 1], [colors.borderStrong, colors.accent]),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

/**
 * The introduction's cover, and the app's first screen: the mark swinging on its string, the
 * wordmark and what SnapWorth is for, on the brand's red. Getting started rolls it up and away
 * like a ticket off a roll, scalloped edge last, and the tour comes in beneath.
 */
function WelcomeCover({
  leaving,
  onStart,
  onSignIn,
  onClose,
}: {
  readonly leaving: boolean;
  readonly onStart: () => void;
  readonly onSignIn?: () => void;
  readonly onClose?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const brand = placeColors(colors, 'feed');
  const sway = useSharedValue(0);
  const fade = useSharedValue(0);
  const focus = useSharedValue(0);
  const dive = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    sway.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(sway);
  }, [reduceMotion, sway]);

  // Leaving is a snap: everything but Worthy steps back, the viewfinder finds his eye, and the
  // cover dives into it until his dark lens fills the screen. The shutter takes it from there.
  useEffect(() => {
    if (!leaving || reduceMotion) return;
    cancelAnimation(sway);
    sway.value = withTiming(0.5, { duration: 160 });
    fade.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    focus.value = withTiming(1, { duration: 280, easing: expressive });
    dive.value = withDelay(
      240,
      withTiming(1, { duration: shutterClosesAt - 200, easing: Easing.in(Easing.cubic) }),
    );
  }, [dive, fade, focus, leaving, reduceMotion, sway]);

  // Light status-bar text on the red while the cover is up.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    StatusBar.setBarStyle('light-content', true);
    return () => StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
  }, [isDark]);

  // The mark hangs from its string's loop and swings a little, as a tag on a rail does.
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(sway.value - 0.5) * 7}deg` }],
  }));
  const restStyle = useAnimatedStyle(() => ({
    opacity: 1 - fade.value,
    transform: [{ translateY: fade.value * 18 }],
  }));
  // Zoomed about the eye, so the lens stays put as everything around it grows past the edges.
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + dive.value * dive.value * 5 }],
  }));
  const lensStyle = useAnimatedStyle(() => ({
    opacity: dive.value > 0 ? 1 : 0,
    transform: [{ scale: 1 + dive.value * dive.value * 26 }],
  }));
  const focusStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, focus.value * 2) * (1 - dive.value * 3),
    transform: [{ scale: 1.7 - 0.7 * focus.value }],
  }));

  return (
    <View
      style={[
        styles.cover,
        {
          backgroundColor: brand.fill,
          paddingTop: insets.top + tokens.spacing[2],
          paddingBottom: insets.bottom + tokens.spacing[4],
        },
      ]}
    >
      <Animated.View style={[styles.coverTop, restStyle]}>
        {onClose ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Close the introduction"
            onPress={onClose}
            hitSlop={tokens.spacing[2]}
            style={styles.coverClose}
          >
            <SWText variant="label" color={brand.ink}>
              Close
            </SWText>
          </PressableScale>
        ) : null}
      </Animated.View>
      <View style={styles.coverCentre}>
        <Animated.View style={[styles.coverMark, markStyle]}>
          <Animated.View style={[styles.zoom, zoomStyle]}>
            <LogoMark size={markSize} />
            <Animated.View style={[styles.lens, lensStyle]} />
          </Animated.View>
          {/* The viewfinder finding focus on the eye. */}
          <Animated.View style={[styles.focus, focusStyle]} pointerEvents="none">
            {focusCorners.map((corner) => (
              <View key={corner} style={[styles.focusCorner, styles[corner]]} />
            ))}
          </Animated.View>
        </Animated.View>
        <Animated.View style={[styles.coverWords, restStyle]}>
          <Wordmark height={44} ink={brand.ink} lensColor={brand.lens} />
          <SWText
            variant="headingLarge"
            color={brand.ink}
            align="center"
            accessibilityRole="header"
          >
            Snap it. Know what it&apos;s worth.
          </SWText>
          <SWText variant="stamp" color={brand.ink}>
            Fair prices for pre-loved things
          </SWText>
        </Animated.View>
      </View>
      <Animated.View style={[styles.coverActions, restStyle]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Get started"
          haptic="pop"
          onPress={onStart}
          style={[styles.coverStart, { backgroundColor: brand.ink }]}
        >
          <SWText variant="button" color={brand.fill}>
            Get started
          </SWText>
        </PressableScale>
        {onSignIn ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="I already have an account. Sign in"
            haptic="none"
            onPress={onSignIn}
            style={styles.signIn}
          >
            <SWText variant="bodyMedium" color={brand.ink}>
              Have an account?{' '}
              <SWText variant="label" color={brand.ink}>
                Sign in
              </SWText>
            </SWText>
          </PressableScale>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** Worthy on the cover, and where his eye sits in him: the snap zooms about that point. */
const markSize = 156;
const eye = { x: markSize * 0.3837, y: markSize * 0.3037, pupil: markSize * 0.066 } as const;
const focusBox = 58;
const focusCorners = ['tl', 'tr', 'bl', 'br'] as const;

const dot = 7;
const gutter = tokens.layout.pageGutterCompact;

const stylesFor = themedStyles((colors) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    overflow: 'hidden',
  },
  sceneSpot: {
    position: 'absolute',
  },
  skipSpot: {
    position: 'absolute',
    right: gutter - tokens.spacing[2],
    width: 72,
    height: 40,
  },
  below: {
    position: 'absolute',
    left: gutter,
    right: gutter,
    bottom: 0,
    justifyContent: 'flex-end',
    gap: tokens.spacing[3],
  },
  dots: {
    alignItems: 'center',
  },
  dotRow: {
    flexDirection: 'row',
    gap: tokens.spacing[2] - 2,
  },
  dot: {
    height: dot,
    borderRadius: tokens.radius.full,
  },
  copy: {
    height: 108,
  },
  copyPage: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
  },
  body: {
    marginTop: tokens.spacing[2],
  },
  actions: {
    gap: tokens.spacing[2],
  },
  // Cut like everything else you can press and hold in the app: ink outline, hard shadow.
  primary: {
    height: tokens.layout.primaryButton,
    borderRadius: tokens.radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...held(colors),
  },
  primaryPressed: {
    backgroundColor: colors.accentPressed,
  },
  primaryLabel: {
    position: 'absolute',
  },
  signIn: {
    alignSelf: 'center',
    paddingVertical: tokens.spacing[1],
  },
  why: {
    minHeight: 34,
    justifyContent: 'center',
    marginBottom: tokens.spacing[1],
  },
  linkLine: {
    height: 30,
  },
  linkRow: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  cover: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: gutter,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  coverClose: {
    paddingVertical: tokens.spacing[2],
    paddingLeft: tokens.spacing[3],
  },
  coverTop: {
    minHeight: tokens.layout.headerCompact,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  coverCentre: {
    alignItems: 'center',
    gap: tokens.spacing[4],
  },
  // Turned about the top of its string, so the swing reads as hanging.
  coverMark: {
    marginBottom: tokens.spacing[4],
    transformOrigin: 'top left',
  },
  coverWords: {
    alignItems: 'center',
    gap: tokens.spacing[4],
  },
  zoom: {
    width: markSize,
    height: markSize,
    // As a string: the web ignores the array form and would zoom about the mark's middle.
    transformOrigin: `${eye.x}px ${eye.y}px`,
  },
  // The pupil, which grows into the dark of the lens the cover dives into.
  lens: {
    position: 'absolute',
    left: eye.x - eye.pupil,
    top: eye.y - eye.pupil,
    width: eye.pupil * 2,
    height: eye.pupil * 2,
    borderRadius: eye.pupil,
    backgroundColor: tokens.color.light.textPrimary,
  },
  focus: {
    position: 'absolute',
    left: eye.x - focusBox / 2,
    top: eye.y - focusBox / 2,
    width: focusBox,
    height: focusBox,
  },
  focusCorner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: tokens.overlay.text,
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  coverActions: {
    gap: tokens.spacing[3],
    // A hand's width, however wide the window: a full-width bar reads as a banner, not a button.
    width: '100%',
    maxWidth: tokens.layout.phoneColumn,
    alignSelf: 'center',
  },
  // Cut like everything else you can press and hold in the app: ink outline, hard shadow.
  coverStart: {
    height: tokens.layout.primaryButton,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...held(colors),
  },
}));
