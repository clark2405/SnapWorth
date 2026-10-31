import { ArrowUp, X, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import { Worthy, type CompanionMood } from './Worthy';
import { GlassSurface } from './GlassSurface';
import { PressableScale } from './PressableScale';
import { contentScrolling, tabBarFolded } from './scroll-signal';
import { SWText, typeStyle } from './SWText';
import { hideWebFocusOutline } from './TextField';
import { paperIn } from './paper-motion';

export interface CompanionAction {
  readonly key: string;
  readonly label: string;
  readonly detail?: string;
  readonly icon: LucideIcon;
  readonly onPress: () => void;
}

export interface CompanionProps {
  /** What Worthy offers on the current screen, most useful first. At most four are shown. */
  readonly actions: readonly CompanionAction[];
  /** One line Worthy says when opened, e.g. "This jacket's asking ₱3,200. Want a second opinion?" */
  readonly greeting: string;
  /** A short nudge shown beside the orb once when the screen opens. */
  readonly hint?: string;
  readonly onAsk: (question: string) => void;
  /** Press-and-hold shortcut: straight to the camera. */
  readonly onHoldSnap?: () => void;
  /**
   * Asked before Worthy opens, with the way to open it: call `open` to go ahead, or don't (for a
   * guest the host shows why an account is needed instead). Without it, a tap opens straight away.
   */
  readonly onRequestOpen?: (open: () => void) => void;
  /** Distance from the bottom edge to rest above, e.g. the tab bar. */
  readonly bottomOffset?: number;
  /** The same while the tab bar is folded (scrolled down a tab), when it's shorter. */
  readonly foldedBottomOffset?: number;
  readonly hidden?: boolean;
}

const orbSize = 56;
/** Worthy's size while tucked, as a share of its resting size. */
const tuckedScale = 0.78;
/**
 * How far it slides into the edge while tucked, as a share of its size: enough that the shrunken
 * Worthy keeps 45% of itself, eye included, on screen (0.5 + 0.05 × tuckedScale).
 */
const tuckShift = 0.5 + 0.05 * tuckedScale;
const edgeGap = 16;
const holdMs = 520;
/** How long Worthy waits untouched before tucking itself half away at its edge. */
const idleTuckMs = 5000;
// Worthy introduces itself once per session; after that the orb stays quiet until asked.
let hintShownThisSession = false;

/**
 * Worthy, the AI companion. A living orb that floats above the content: tap it and it blooms
 * into a glass panel of things it can do right here; hold it to jump straight to the camera;
 * drag it and it snaps to whichever edge is nearer. It greets you in its own rounded voice,
 * typed out as if it were speaking.
 */
export function Companion({
  actions,
  greeting,
  hint,
  onAsk,
  onHoldSnap,
  onRequestOpen,
  bottomOffset = 0,
  foldedBottomOffset,
  hidden = false,
}: CompanionProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const styles = useThemedStyles(stylesFor);
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<CompanionMood>('idle');
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [showHint, setShowHint] = useState(false);
  const cameraOpening = useRef(false);

  const edgeX = (to: 'left' | 'right') => (to === 'right' ? width - orbSize - edgeGap : edgeGap);
  // The lowest it can sit: above the tab bar, or above the folded bar while it's folded.
  const lowest = (offset: number) => height - insets.bottom - offset - orbSize - tokens.spacing[3];
  const restY = lowest(bottomOffset);
  const foldedRestY = lowest(foldedBottomOffset ?? bottomOffset);
  const highest = insets.top + 80;
  // Position lives on the UI thread. React state only mirrors it for what's drawn beside Worthy
  // (its panel and hint), and never drives it, so a throw settles in one unbroken motion.
  const sideRef = useRef(side);
  const x = useSharedValue(edgeX(side));
  /** How far above its lowest spot the person left it. */
  const raised = useSharedValue(0);
  const y = useSharedValue(restY);
  const lift = useSharedValue(hidden ? 0 : 1);
  const charge = useSharedValue(0);
  /** 1 while Worthy is tucked into its edge after a few untouched seconds. */
  const idle = useSharedValue(0);
  const [dragY, setDragY] = useState(0);

  // Only a new window size moves it sideways; a drag already put it where it belongs.
  useEffect(() => {
    x.value = withSpring(edgeX(sideRef.current), tokens.motion.spring.gentle);
  }, [width]);
  // A new floor (another screen, the tab bar folding or opening) carries it along, keeping the
  // height the person chose but never sinking behind a bar.
  useAnimatedReaction(
    () => (tabBarFolded.value > 0.5 ? foldedRestY : restY),
    (floor, previous) => {
      if (floor === previous) return;
      y.value = withSpring(Math.max(highest, floor - raised.value), tokens.motion.spring.gentle);
    },
    [foldedRestY, restY, highest],
  );

  // After a few seconds untouched, Worthy slips half out of sight at its edge; any touch, or
  // opening it, brings it back.
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wake = useCallback(() => {
    idle.value = withTiming(0, { duration: 240, easing: Easing.bezier(0.16, 1, 0.3, 1) });
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      idle.value = withTiming(1, { duration: 520, easing: Easing.bezier(0.16, 1, 0.3, 1) });
    }, idleTuckMs);
  }, [idle]);
  useEffect(() => {
    if (open || showHint || hidden) {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idle.value = withTiming(0, { duration: 240 });
      return;
    }
    wake();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [hidden, idle, open, showHint, wake]);

  useEffect(() => {
    cameraOpening.current = false;
    lift.value = reduceMotion
      ? withTiming(hidden ? 0 : 1, { duration: 160 })
      : withSpring(hidden ? 0 : 1, tokens.motion.spring.playful);
    if (hidden) setOpen(false);
  }, [hidden, lift, reduceMotion]);

  // One nudge per session, a beat after the first screen settles.
  useEffect(() => {
    if (!hint || hidden || hintShownThisSession) return;
    const show = setTimeout(() => {
      hintShownThisSession = true;
      setShowHint(true);
    }, 1100);
    const hide = setTimeout(() => setShowHint(false), 5600);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      setShowHint(false);
    };
  }, [hidden, hint]);

  const openPanel = useCallback(() => {
    haptic('pop');
    setShowHint(false);
    setMood('attentive');
    setOpen(true);
  }, []);

  const requestOpen = useCallback(() => {
    if (!onRequestOpen) return openPanel();
    setShowHint(false);
    onRequestOpen(openPanel);
  }, [onRequestOpen, openPanel]);

  const closePanel = useCallback(() => {
    Keyboard.dismiss();
    setOpen(false);
    setMood('idle');
  }, []);

  const runAction = useCallback((action: () => void) => {
    haptic('tap');
    setMood('thinking');
    setOpen(false);
    Keyboard.dismiss();
    setTimeout(() => {
      action();
      setMood('idle');
    }, 260);
  }, []);

  const holdSnap = useCallback(() => {
    if (hidden || cameraOpening.current || !onHoldSnap) return;
    cameraOpening.current = true;
    haptic('heavy');
    setOpen(false);
    setShowHint(false);
    setMood('idle');
    Keyboard.dismiss();
    onHoldSnap();
  }, [hidden, onHoldSnap]);

  const settleSide = useCallback((next: 'left' | 'right') => {
    if (next !== sideRef.current) haptic('select');
    sideRef.current = next;
    setSide(next);
  }, []);

  const tap = Gesture.Tap()
    .enabled(!hidden)
    .maxDuration(holdMs - 20)
    .onBegin(() => {
      runOnJS(wake)();
    })
    .onEnd((_event, success) => {
      if (success) runOnJS(requestOpen)();
    });

  const hold = Gesture.LongPress()
    .enabled(!hidden)
    .minDuration(holdMs)
    .onBegin(() => {
      charge.value = withTiming(1, { duration: holdMs, easing: Easing.linear });
      runOnJS(setMood)('charging');
    })
    // Present the native camera after release, not under an active touch gesture.
    .onEnd((_event, success) => {
      if (success && onHoldSnap) runOnJS(holdSnap)();
    })
    .onFinalize(() => {
      charge.value = withTiming(0, { duration: 200 });
      runOnJS(setMood)('idle');
    });

  const drag = Gesture.Pan()
    .enabled(!hidden)
    .activeOffsetX([-12, 12])
    .activeOffsetY([-12, 12])
    .onBegin(() => {
      runOnJS(wake)();
    })
    .onChange((event) => {
      x.value += event.changeX;
      y.value += event.changeY;
    })
    .onEnd((event) => {
      const projected = x.value + event.velocityX * 0.15;
      const nextSide = projected + orbSize / 2 > width / 2 ? 'right' : 'left';
      const targetX = nextSide === 'right' ? width - orbSize - edgeGap : edgeGap;
      const floor = tabBarFolded.value > 0.5 ? foldedRestY : restY;
      const targetY = Math.min(floor, Math.max(highest, y.value + event.velocityY * 0.1));
      raised.value = floor - targetY;
      // One spring each way, carrying the throw's speed: nothing restarts it afterwards.
      x.value = withSpring(targetX, { ...tokens.motion.spring.gentle, velocity: event.velocityX });
      y.value = withSpring(targetY, { ...tokens.motion.spring.gentle, velocity: event.velocityY });
      runOnJS(setDragY)(targetY - restY);
      runOnJS(settleSide)(nextSide);
    });

  const gesture = Gesture.Exclusive(drag, hold, tap);

  // While the page scrolls, Worthy shrinks a little and tucks into its edge, but never leaves:
  // about half of it, eye included, always peeks out, so it stays out of the way of what you
  // are reading without disappearing. It slides back out once the content settles.
  const tuckDirection = side === 'right' ? 1 : -1;
  const orbStyle = useAnimatedStyle(() => {
    const tuck = Math.max(contentScrolling.value, idle.value);
    return {
      opacity: lift.value,
      transform: [
        { translateX: x.value + tuck * tuckDirection * (orbSize * tuckShift + edgeGap) },
        { translateY: y.value + (1 - lift.value) * 80 },
        { rotate: `${tuck * tuckDirection * -10}deg` },
        { scale: 0.4 + lift.value * 0.6 - charge.value * 0.08 - tuck * (1 - tuckedScale) },
      ],
    };
  });
  // The hint rides off with it. Transform only: fading would leave its glass unrendered on iOS.
  const hintTuckStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentScrolling.value * tuckDirection * (width * 0.9) }],
  }));
  const chargeStyle = useAnimatedStyle(() => ({
    opacity: charge.value,
    transform: [{ scale: 1 + charge.value * 0.35 }],
  }));

  return (
    <View style={styles.host} pointerEvents={hidden ? 'none' : 'box-none'}>
      {open ? (
        <CompanionPanel
          greeting={greeting}
          actions={actions}
          side={side}
          bottom={height - restY - dragY + tokens.spacing[3]}
          onClose={closePanel}
          onAction={runAction}
          onAsk={(question) => runAction(() => onAsk(question))}
        />
      ) : null}
      {showHint && hint && !open ? (
        <Animated.View
          entering={glassEntering}
          exiting={FadeOut.duration(160)}
          style={[
            styles.hint,
            hintTuckStyle,
            side === 'right'
              ? { right: edgeGap + orbSize + tokens.spacing[2] }
              : { left: edgeGap + orbSize + tokens.spacing[2] },
            { top: restY + dragY + orbSize / 2 - 20 },
          ]}
        >
          <Pressable onPress={requestOpen} accessibilityRole="button" accessibilityLabel={hint}>
            <GlassSurface style={styles.hintBubble}>
              <SWText variant="labelMedium" numberOfLines={2}>
                {hint}
              </SWText>
            </GlassSurface>
          </Pressable>
        </Animated.View>
      ) : null}
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Worthy, your pricing companion"
          accessibilityHint="Opens actions for this screen. Hold to open the camera."
          accessibilityActions={[{ name: 'activate' }, { name: 'longpress' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'longpress') holdSnap();
            else requestOpen();
          }}
          style={[styles.orb, orbStyle]}
        >
          <Animated.View style={[styles.charge, chargeStyle]} />
          <Worthy size={orbSize} mood={open ? 'attentive' : mood} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/**
 * Entrance for anything holding Liquid Glass: it rises and swells into place without touching
 * opacity, which would leave the glass unrendered on iOS 26.
 */
function glassEntering() {
  'worklet';
  const spring = { damping: 16, stiffness: 240, mass: 0.8 };
  return {
    initialValues: { transform: [{ translateY: 10 }, { scale: 0.6 }] },
    animations: {
      transform: [{ translateY: withSpring(0, spring) }, { scale: withSpring(1, spring) }],
    },
  };
}

function CompanionPanel({
  greeting,
  actions,
  side,
  bottom,
  onClose,
  onAction,
  onAsk,
}: {
  readonly greeting: string;
  readonly actions: readonly CompanionAction[];
  readonly side: 'left' | 'right';
  readonly bottom: number;
  readonly onClose: () => void;
  readonly onAction: (action: () => void) => void;
  readonly onAsk: (question: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const bloom = useSharedValue(0);
  const [typed, setTyped] = useState(reduceMotion ? greeting : '');
  const [question, setQuestion] = useState('');
  const input = useRef<TextInput>(null);

  useEffect(() => {
    bloom.value = reduceMotion
      ? withTiming(1, { duration: 160 })
      : withSequence(withSpring(1, { damping: 16, stiffness: 240, mass: 0.8 }));
  }, [bloom, reduceMotion]);

  // Worthy "speaks": the greeting types itself out, a few characters per frame.
  useEffect(() => {
    if (reduceMotion) return;
    let index = 0;
    const timer = setInterval(() => {
      index += 2;
      setTyped(greeting.slice(0, index));
      if (index >= greeting.length) clearInterval(timer);
    }, 18);
    return () => clearInterval(timer);
  }, [greeting, reduceMotion]);

  // Scale and travel only: Liquid Glass drops its material if an ancestor's opacity animates,
  // so the panel grows out of the orb instead of fading in.
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - bloom.value) * 40 }, { scale: 0.25 + bloom.value * 0.75 }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: bloom.value }));

  const submit = () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    onAsk(trimmed);
    setQuestion('');
  };

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable
          accessibilityLabel="Close Worthy"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.panelWrap,
          { bottom, transformOrigin: side === 'right' ? 'bottom right' : 'bottom left' },
          panelStyle,
        ]}
      >
        <GlassSurface style={styles.panel}>
          <View style={styles.panelHeader}>
            <Worthy size={30} mood="attentive" />
            <View style={styles.flex}>
              <SWText variant="companion">Worthy</SWText>
            </View>
            <PressableScale accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <X size={16} strokeWidth={2.4} color={colors.textSecondary} />
            </PressableScale>
          </View>

          <SWText variant="bodyLarge" style={styles.greeting} accessibilityLabel={greeting}>
            {typed}
            {typed.length < greeting.length ? (
              <SWText variant="bodyLarge" tone="textMuted">
                ▍
              </SWText>
            ) : null}
          </SWText>

          <View style={styles.actions}>
            {actions.slice(0, 4).map((action, index) => {
              const Icon = action.icon;
              return (
                <Animated.View
                  key={action.key}
                  entering={reduceMotion ? FadeIn : paperIn(120 + index * 55)}
                >
                  <PressableScale
                    accessibilityLabel={action.label}
                    accessibilityHint={action.detail}
                    haptic="none"
                    depth="surface"
                    onPress={() => onAction(action.onPress)}
                    style={({ pressed }) => [styles.action, pressed ? styles.actionPressed : null]}
                  >
                    <View style={styles.actionIcon}>
                      <Icon size={16} strokeWidth={1.75} color={colors.textPrimary} />
                    </View>
                    <View style={styles.flex}>
                      <SWText variant="headingSmall">{action.label}</SWText>
                      {action.detail ? (
                        <SWText variant="caption" tone="textMuted" numberOfLines={1}>
                          {action.detail}
                        </SWText>
                      ) : null}
                    </View>
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>

          <Animated.View entering={FadeIn.delay(320)} style={styles.ask}>
            <TextInput
              ref={input}
              value={question}
              onChangeText={setQuestion}
              placeholder="Ask Worthy anything…"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.accent}
              returnKeyType="send"
              onSubmitEditing={submit}
              style={[
                styles.askInput,
                typeStyle('bodyMedium'),
                { color: colors.textPrimary, lineHeight: undefined },
                hideWebFocusOutline,
              ]}
            />
            <PressableScale
              accessibilityLabel="Ask"
              disabled={!question.trim()}
              haptic="pop"
              onPress={submit}
              style={[styles.send, question.trim() ? null : styles.sendIdle]}
            >
              <ArrowUp size={17} strokeWidth={2.6} color={colors.onInverse} />
            </PressableScale>
          </Animated.View>
        </GlassSurface>
      </Animated.View>
    </>
  );
}

const stylesFor = themedStyles((colors, name) => ({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    pointerEvents: 'box-none',
  },
  orb: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: orbSize,
    height: orbSize,
    borderRadius: orbSize / 2,
    shadowColor: tokens.shadow.dark,
    shadowOpacity: name === 'dark' ? 0.9 : 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  charge: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: orbSize,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  scrim: {
    backgroundColor: tokens.overlay.scrim,
  },
  panelWrap: {
    position: 'absolute',
    left: edgeGap,
    right: edgeGap,
    maxWidth: tokens.layout.phoneColumn - edgeGap * 2,
    alignSelf: 'center',
    shadowColor: tokens.shadow[name],
    shadowOpacity: 1,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
  },
  panel: {
    borderRadius: tokens.radius.xlarge,
    padding: tokens.spacing[4],
    gap: tokens.spacing[4],
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  flex: {
    flex: 1,
  },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  greeting: {
    minHeight: 48,
  },
  actions: {
    gap: tokens.spacing[2],
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    padding: tokens.spacing[3],
    borderRadius: tokens.radius.large,
    backgroundColor: colors.surface,
  },
  actionPressed: {
    backgroundColor: colors.sunken,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingLeft: tokens.spacing[4],
    paddingRight: tokens.spacing[1],
    minHeight: 46,
    borderRadius: tokens.radius.full,
    backgroundColor: colors.sunken,
  },
  askInput: {
    flex: 1,
    alignSelf: 'stretch',
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inverse,
  },
  sendIdle: {
    opacity: 0.35,
  },
  hint: {
    position: 'absolute',
    maxWidth: 230,
  },
  hintBubble: {
    borderRadius: tokens.radius.large,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
  },
}));
