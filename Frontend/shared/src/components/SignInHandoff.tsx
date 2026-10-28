import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  cancelAnimation,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import {
  endHandoff,
  markClosed,
  registerHandoffOverlay,
  screenPoints,
  tagFrameFor,
  tagPoints,
  useHandoffState,
  type HandoffState,
} from './sign-in-handoff';
import { SWText } from './SWText';
import { TagPath } from './TagPath';

/** The squeeze and the unfold share one curve: a firm start and a long, soft landing. */
const squeeze = Easing.bezier(0.65, 0, 0.25, 1);
const closeMs = 800;
const faceAt = 380;
const faceMs = 420;
const stampAt = 900;
const stampMs = 320;
/**
 * His face now covers the window, so nothing of the sign-in screen shows: it can move on behind
 * the tag while the stamp is still landing, and the app starts drawing as early as it can.
 */
const coveredAt = faceAt + faceMs + 20;
/** The tag stays shut at least this long from the tap, so the stamp is seen to land. */
const heldUntil = 1400;
/** Room for the screen behind to draw (and its own entrance to finish) before the tag opens. */
const openAfter = 220;
/**
 * From the moment the outline shuts, Worthy looks around and dots pulse under him, so the wait
 * for the sign-in and the app reads as work going on, never as a stuck screen. These run on the
 * UI thread, so they keep moving even while the app is busy building the screen behind.
 */
const waitingAt = closeMs;
const lookMs = 700;
const pulseMs = 1100;
const openMs = 850;

/**
 * The sign-in hand-off, drawn over the whole app (see `sign-in-handoff`). It's one shape: the page
 * colour everywhere except a tag-shaped window. Closing, the window shrinks from the screen's
 * edges to Worthy's outline, so the real screen squeezes into the tag; his face and a price-gun
 * stamp land on it. Opening, the face lifts and the window grows back to the screen's edges with
 * whatever is now behind it, so the tag unfolds into the app.
 */
export function SignInHandoff() {
  const state = useHandoffState();
  const reduceMotion = useReducedMotion();
  // Without motion there's no overlay to wait for: signing in simply moves on.
  useEffect(() => (reduceMotion ? undefined : registerHandoffOverlay()), [reduceMotion]);
  if (!state || reduceMotion) return null;
  return <Handoff key={state.id} state={state} />;
}

function Handoff({ state }: { readonly state: HandoffState }) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const frame = useMemo(() => tagFrameFor(width, height), [width, height]);
  const screen = useMemo(() => screenPoints(width, height), [width, height]);
  const tag = useMemo(() => tagPoints(frame), [frame]);
  const shape = useSharedValue(0);
  const face = useSharedValue(0);
  const stamp = useSharedValue(0);
  const waiting = useSharedValue(0);
  const look = useSharedValue(0);
  const pulse = useSharedValue(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    shape.value = withTiming(1, { duration: closeMs, easing: squeeze });
    face.value = withDelay(faceAt, withTiming(1, { duration: faceMs }));
    stamp.value = withDelay(
      stampAt,
      withTiming(1, { duration: stampMs, easing: Easing.out(Easing.back(2.4)) }),
    );
    waiting.value = withDelay(waitingAt, withTiming(1, { duration: 320 }));
    const glance = { duration: lookMs, easing: Easing.inOut(Easing.sin) };
    look.value = withDelay(
      waitingAt,
      withRepeat(
        withSequence(
          withTiming(-1, glance),
          withDelay(250, withTiming(1, { ...glance, duration: lookMs * 1.6 })),
          withDelay(250, withTiming(0, glance)),
          withDelay(500, withTiming(0, { duration: 0 })),
        ),
        -1,
      ),
    );
    pulse.value = withDelay(
      waitingAt,
      withRepeat(withTiming(1, { duration: pulseMs, easing: Easing.linear }), -1),
    );
    const closed = setTimeout(markClosed, coveredAt);
    return () => {
      clearTimeout(closed);
      cancelAnimation(look);
      cancelAnimation(pulse);
    };
  }, [face, look, pulse, shape, stamp, waiting]);

  useEffect(() => {
    if (state.stage !== 'opening') return;
    let done: ReturnType<typeof setTimeout> | undefined;
    const held = Math.max(openAfter, heldUntil - (Date.now() - startedAt.current));
    const open = setTimeout(() => {
      waiting.value = withTiming(0, { duration: 140 });
      face.value = withTiming(0, { duration: 200 });
      shape.value = withTiming(0, { duration: openMs, easing: squeeze });
      done = setTimeout(endHandoff, openMs + 60);
    }, held);
    return () => {
      clearTimeout(open);
      clearTimeout(done);
    };
  }, [face, shape, state.stage, waiting]);

  const faceStyle = useAnimatedStyle(() => ({ opacity: face.value }));
  // The eye, cheeks and greeting arrive once the outline has nearly finished closing.
  const detailStyle = useAnimatedStyle(() => ({
    opacity: interpolate(face.value, [0.6, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const stampStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, stamp.value * 2) * face.value,
    transform: [{ rotate: '-11deg' }, { scale: 2.2 - 1.2 * stamp.value }],
  }));

  const { cx, top, width: w, height: h } = frame;
  const eye = w * 0.205;
  const pupilStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 1 + look.value * eye * 0.15 }],
  }));
  const waitingStyle = useAnimatedStyle(() => ({ opacity: waiting.value * face.value }));

  const curl = w * 0.22;
  const screenRect = `M0 0H${width}V${height}H0Z `;

  return (
    // Once it's opening the app is ready beneath: touches go straight through, so the feed scrolls
    // while the tag is still unfolding.
    <View
      style={styles.layer}
      pointerEvents={state.stage === 'opening' ? 'none' : 'auto'}
      accessibilityViewIsModal={state.stage !== 'opening'}
    >
      {/* The page colour around the window, the window itself showing the screen beneath. */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <TagPath
          progress={shape}
          from={screen}
          to={tag}
          prefix={screenRect}
          fill={colors.canvas}
          fillRule="evenodd"
        />
      </Svg>

      {/* Worthy's face: cut from his red, outlined and shadowed like every card. */}
      <Animated.View style={[StyleSheet.absoluteFill, faceStyle]} pointerEvents="none">
        <Svg width={width} height={height}>
          <TagPath progress={shape} from={screen} to={tag} fill={colors.heldShadow} translate={3} />
          <TagPath
            progress={shape}
            from={screen}
            to={tag}
            fill={colors.accent}
            stroke={colors.heldEdge}
            strokeWidth={2.5}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, detailStyle]} pointerEvents="none">
        {/* His string, curled over the point. */}
        <Svg
          width={curl}
          height={curl}
          viewBox="0 0 40 40"
          style={{ position: 'absolute', left: cx - curl / 2, top: top - curl + w * 0.05 }}
        >
          <Path
            d="M20 38 C 20 26, 8 24, 10 14 C 12 5, 28 6, 27 15 C 26 22, 17 20, 18 14"
            fill="none"
            stroke={colors.heldEdge}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </Svg>
        <View
          style={[
            styles.eye,
            {
              left: cx - eye / 2,
              top: top + 0.236 * h - eye / 2,
              width: eye,
              height: eye,
              borderRadius: eye / 2,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.pupil,
              { width: eye * 0.52, height: eye * 0.52, borderRadius: eye * 0.26 },
              pupilStyle,
            ]}
          />
        </View>
        <View
          style={[styles.cheeks, { left: cx - w * 0.295, top: top + 0.414 * h, width: w * 0.59 }]}
        >
          <View style={[styles.cheek, { width: w * 0.105, height: w * 0.055 }]} />
          <View style={[styles.cheek, { width: w * 0.105, height: w * 0.055 }]} />
        </View>
        <View
          style={[styles.greeting, { left: cx - w * 0.45, top: top + 0.49 * h, width: w * 0.9 }]}
        >
          <SWText variant="stamp" color={colors.onAccent} align="center">
            {state.eyebrow.toUpperCase()}
          </SWText>
          <SWText
            variant="headingLarge"
            color={colors.onAccent}
            align="center"
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {state.name ? `Hi,\n${state.name}` : 'Hi\nthere'}
          </SWText>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.stamp,
          { left: cx - w * 0.45, top: top + 0.86 * h, width: w * 0.9 },
          stampStyle,
        ]}
        pointerEvents="none"
      >
        <View style={styles.stampInk}>
          <SWText variant="stamp" color={colors.onMarigold} numberOfLines={1}>
            {state.stamp}
          </SWText>
        </View>
      </Animated.View>

      {/* While the sign-in and the app behind are getting ready. */}
      <Animated.View
        style={[styles.waiting, { top: top + h + w * 0.16 }, waitingStyle]}
        pointerEvents="none"
        accessibilityLiveRegion="polite"
      >
        <View style={styles.dots}>
          {[0, 1, 2].map((index) => (
            <Dot key={index} index={index} pulse={pulse} />
          ))}
        </View>
        <SWText variant="labelSmall" tone="textSecondary" align="center">
          {state.waiting}
        </SWText>
      </Animated.View>
    </View>
  );
}

/** One of the three waiting dots, each lifting a third of a beat after the one before it. */
function Dot({ index, pulse }: { readonly index: number; readonly pulse: SharedValue<number> }) {
  const styles = useThemedStyles(stylesFor);
  const style = useAnimatedStyle(() => {
    const phase = (pulse.value - index / 3 + 1) % 1;
    const lift = phase < 0.5 ? Math.sin(phase * 2 * Math.PI) : 0;
    return { opacity: 0.35 + 0.65 * lift, transform: [{ translateY: -lift * 4 }] };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const stylesFor = themedStyles((colors) => ({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
  },
  eye: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.overlay.text,
    borderWidth: 2,
    borderColor: colors.onMarigold,
  },
  pupil: {
    backgroundColor: colors.onMarigold,
  },
  cheeks: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cheek: {
    borderRadius: tokens.radius.full,
    backgroundColor: colors.onAccent,
    opacity: 0.32,
  },
  greeting: {
    position: 'absolute',
    alignItems: 'center',
    gap: tokens.spacing[1],
  },
  stamp: {
    position: 'absolute',
    alignItems: 'center',
  },
  waiting: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  dots: {
    flexDirection: 'row',
    gap: tokens.spacing[2],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  stampInk: {
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[1],
    borderRadius: tokens.radius.small,
    borderWidth: 2,
    borderColor: colors.onMarigold,
    backgroundColor: colors.marigold,
  },
}));
