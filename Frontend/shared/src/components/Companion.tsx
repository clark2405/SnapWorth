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
  FadeInDown,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import { CompanionOrb, type CompanionMood } from './CompanionOrb';
import { GlassSurface } from './GlassSurface';
import { PressableScale } from './PressableScale';
import { SWText, typeStyle } from './SWText';
import { hideWebFocusOutline } from './TextField';

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
  /** Distance from the bottom edge to rest above, e.g. the tab bar. */
  readonly bottomOffset?: number;
  readonly hidden?: boolean;
}

const orbSize = 58;
const edgeGap = 16;
const holdMs = 520;

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
  bottomOffset = 0,
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

  const restX = side === 'right' ? width - orbSize - edgeGap : edgeGap;
  const restY = height - insets.bottom - bottomOffset - orbSize - tokens.spacing[3];
  const x = useSharedValue(restX);
  const y = useSharedValue(restY);
  const lift = useSharedValue(hidden ? 0 : 1);
  const charge = useSharedValue(0);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    x.value = withSpring(restX, tokens.motion.spring.smooth);
  }, [restX, x]);
  useEffect(() => {
    y.value = withSpring(restY + dragY, tokens.motion.spring.smooth);
  }, [dragY, restY, y]);
  useEffect(() => {
    lift.value = reduceMotion
      ? withTiming(hidden ? 0 : 1, { duration: 160 })
      : withSpring(hidden ? 0 : 1, tokens.motion.spring.playful);
    if (hidden) setOpen(false);
  }, [hidden, lift, reduceMotion]);

  // One nudge per new hint, a beat after the screen settles.
  useEffect(() => {
    if (!hint || hidden) return;
    const show = setTimeout(() => setShowHint(true), 1100);
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
    haptic('heavy');
    setMood('thinking');
    setTimeout(() => {
      onHoldSnap?.();
      setMood('idle');
    }, 180);
  }, [onHoldSnap]);

  const settleSide = useCallback((next: 'left' | 'right') => {
    haptic('select');
    setSide(next);
  }, []);

  const tap = Gesture.Tap()
    .maxDuration(holdMs - 20)
    .onEnd((_event, success) => {
      if (success) runOnJS(openPanel)();
    });

  const hold = Gesture.LongPress()
    .minDuration(holdMs)
    .onBegin(() => {
      charge.value = withTiming(1, { duration: holdMs, easing: Easing.linear });
      runOnJS(setMood)('charging');
    })
    .onStart(() => {
      if (onHoldSnap) runOnJS(holdSnap)();
    })
    .onFinalize(() => {
      charge.value = withTiming(0, { duration: 200 });
      runOnJS(setMood)('idle');
    });

  const drag = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .activeOffsetY([-12, 12])
    .onChange((event) => {
      x.value += event.changeX;
      y.value += event.changeY;
    })
    .onEnd((event) => {
      const projected = x.value + event.velocityX * 0.15;
      const nextSide = projected + orbSize / 2 > width / 2 ? 'right' : 'left';
      const targetX = nextSide === 'right' ? width - orbSize - edgeGap : edgeGap;
      const minY = insets.top + 80;
      const maxY = height - insets.bottom - bottomOffset - orbSize - tokens.spacing[3];
      const targetY = Math.min(maxY, Math.max(minY, y.value + event.velocityY * 0.1));
      runOnJS(setDragY)(targetY - maxY);
      x.value = withSpring(targetX, { ...tokens.motion.spring.smooth, velocity: event.velocityX });
      y.value = withSpring(targetY, { ...tokens.motion.spring.smooth, velocity: event.velocityY });
      runOnJS(settleSide)(nextSide);
    });

  const gesture = Gesture.Exclusive(drag, hold, tap);

  const orbStyle = useAnimatedStyle(() => ({
    opacity: lift.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value + (1 - lift.value) * 80 },
      { scale: 0.4 + lift.value * 0.6 - charge.value * 0.08 },
    ],
  }));
  const chargeStyle = useAnimatedStyle(() => ({
    opacity: charge.value,
    transform: [{ scale: 1 + charge.value * 0.35 }],
  }));

  return (
    <View style={styles.host}>
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
            side === 'right'
              ? { right: edgeGap + orbSize + tokens.spacing[2] }
              : { left: edgeGap + orbSize + tokens.spacing[2] },
            { top: restY + dragY + orbSize / 2 - 20 },
          ]}
        >
          <Pressable onPress={openPanel} accessibilityRole="button" accessibilityLabel={hint}>
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
            else openPanel();
          }}
          style={[styles.orb, orbStyle]}
        >
          <Animated.View style={[styles.charge, chargeStyle]} />
          <CompanionOrb size={orbSize} mood={open ? 'attentive' : mood} />
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
            <CompanionOrb size={30} mood="attentive" />
            <View style={styles.flex}>
              <SWText variant="companion">Worthy</SWText>
              <SWText variant="caption" tone="textMuted">
                Your pricing companion
              </SWText>
            </View>
            <PressableScale accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <X size={16} strokeWidth={2.4} color={colors.textSecondary} />
            </PressableScale>
          </View>

          <SWText variant="bodyLarge" style={styles.greeting} accessibilityLabel={greeting}>
            {typed}
            {typed.length < greeting.length ? (
              <SWText variant="bodyLarge" tone="accent">
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
                  entering={
                    reduceMotion
                      ? FadeIn
                      : FadeInDown.delay(120 + index * 55)
                          .springify()
                          .damping(18)
                  }
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
                      <Icon size={17} strokeWidth={2.2} color={colors.accent} />
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
    shadowColor: tokens.aurora[0],
    shadowOpacity: name === 'dark' ? 0.55 : 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  charge: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: orbSize,
    borderWidth: 2.5,
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
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
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
