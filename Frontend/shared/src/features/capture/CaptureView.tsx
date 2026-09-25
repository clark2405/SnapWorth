import { useIsFocused } from 'expo-router';
import { History, Images, ScanLine, X, Zap, ZapOff } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOutUp,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { IconButton, PressableScale, SWText } from '../../components';
import { haptic, tokens } from '../../design';
import { previewItem } from '../preview/sample-data';

export interface CaptureViewProps {
  /**
   * The live camera preview. Camera access is not wired yet (capture task 5), so by default
   * the viewfinder shows a simulated live scene.
   */
  readonly viewfinder?: ReactNode;
  readonly flashOn?: boolean;
  readonly onClose?: () => void;
  readonly onToggleFlash?: () => void;
  readonly onCapture?: () => void;
  readonly onOpenGallery?: () => void;
  readonly onOpenHistory?: () => void;
  /** Room reserved at the bottom, e.g. for a floating tab bar the camera sits under. */
  readonly bottomInset?: number;
}

const tips = [
  'Fit the whole item in the frame',
  'A shot of the brand tag tightens the range',
  'Show any wear — honest photos sell faster',
];

/**
 * The camera. It is always dark, whatever the app theme, so the scene is the brightest thing on
 * screen. The frame hunts, then locks onto the item with a spring and names what it sees; the
 * shutter compresses, the screen flashes, and the shot flies into the corner before the
 * estimate opens.
 */
export function CaptureView({
  viewfinder,
  flashOn = false,
  onClose,
  onToggleFlash,
  onCapture,
  onOpenGallery,
  onOpenHistory,
  bottomInset = 0,
}: CaptureViewProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const focused = useIsFocusedSafe();
  const [locked, setLocked] = useState(false);
  const [tip, setTip] = useState(0);
  const [shooting, setShooting] = useState(false);

  const hunt = useSharedValue(0);
  const lock = useSharedValue(0);
  const flash = useSharedValue(0);
  const shot = useSharedValue(0);

  // Each time the camera comes into view, the frame hunts and then locks on.
  useEffect(() => {
    if (!focused) return;
    setLocked(false);
    setShooting(false);
    shot.value = 0;
    lock.value = 0;
    if (!reduceMotion) {
      hunt.value = withRepeat(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }
    const timer = setTimeout(() => {
      cancelAnimation(hunt);
      hunt.value = withTiming(0, { duration: 200 });
      lock.value = reduceMotion ? 1 : withSpring(1, tokens.motion.spring.playful);
      setLocked(true);
      haptic('select');
    }, 1300);
    return () => {
      clearTimeout(timer);
      cancelAnimation(hunt);
    };
  }, [focused, hunt, lock, reduceMotion, shot]);

  useEffect(() => {
    if (!focused) return;
    const timer = setInterval(() => setTip((current) => (current + 1) % tips.length), 3400);
    return () => clearInterval(timer);
  }, [focused]);

  const capture = () => {
    if (shooting) return;
    setShooting(true);
    haptic('heavy');
    flash.value = withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 380 }));
    shot.value = withDelay(
      80,
      withTiming(1, { duration: 560, easing: Easing.bezier(0.16, 1, 0.3, 1) }, (done) => {
        if (done && onCapture) runOnJS(onCapture)();
      }),
    );
  };

  const frameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1.18 - lock.value * 0.18 + hunt.value * 0.04 }],
    opacity: 0.55 + lock.value * 0.45,
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const shotStyle = useAnimatedStyle(() => ({
    opacity: shot.value === 0 ? 0 : 1 - Math.max(0, shot.value - 0.8) * 5,
    transform: [
      { translateX: -shot.value * 118 },
      { translateY: shot.value * 300 },
      { scale: 1 - shot.value * 0.84 },
    ],
  }));

  const controlsBottom = insets.bottom + bottomInset + tokens.spacing[4];

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>{viewfinder ?? <SimulatedScene />}</View>
      <Vignette />

      <View style={[styles.topBar, { paddingTop: insets.top + tokens.spacing[2] }]}>
        <IconButton icon={X} label="Close camera" appearance="overlay" onPress={onClose} />
        <Animated.View
          key={locked ? 'locked' : 'hunting'}
          entering={FadeIn.duration(220)}
          style={styles.statusPill}
        >
          <ScanLine size={14} strokeWidth={2.2} color={tokens.overlay.text} />
          <SWText variant="labelSmall" color={tokens.overlay.text}>
            {locked ? 'Nike windbreaker' : 'Looking…'}
          </SWText>
        </Animated.View>
        <IconButton
          icon={flashOn ? Zap : ZapOff}
          label={flashOn ? 'Turn flash off' : 'Turn flash on'}
          appearance="overlay"
          haptic="select"
          onPress={onToggleFlash}
        />
      </View>

      <View style={styles.frameArea}>
        <Animated.View style={[styles.frame, frameStyle]}>
          {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map((corner) => (
            <View key={corner} style={[styles.bracket, styles[corner]]} />
          ))}
        </Animated.View>
      </View>

      <View style={[styles.bottom, { paddingBottom: controlsBottom }]}>
        <View style={styles.tipRow}>
          <Animated.View
            key={tip}
            entering={FadeInDown.duration(320)}
            exiting={FadeOutUp.duration(200)}
          >
            <SWText
              variant="labelMedium"
              color={tokens.overlay.text}
              align="center"
              accessibilityLiveRegion="polite"
            >
              {tips[tip]}
            </SWText>
          </Animated.View>
        </View>
        <View style={styles.controls}>
          <PressableScale
            accessibilityLabel="Choose a photo from your gallery"
            onPress={onOpenGallery}
            style={styles.galleryButton}
          >
            <Image
              source={previewItem.photo}
              style={styles.galleryThumb}
              accessibilityIgnoresInvertColors
            />
            <View style={styles.galleryBadge}>
              <Images size={12} strokeWidth={2.4} color={tokens.overlay.text} />
            </View>
          </PressableScale>
          <Shutter onPress={capture} disabled={shooting} ready={locked} />
          <IconButton
            icon={History}
            label="Open your history"
            appearance="overlay"
            onPress={onOpenHistory}
          />
        </View>
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
      {shooting ? (
        <Animated.View style={[styles.flyingShot, shotStyle]}>
          <Image source={previewItem.photo} style={styles.flyingImage} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** The shutter: a ring around a disk that squeezes on touch and glows once the frame locks. */
function Shutter({
  onPress,
  disabled,
  ready,
}: {
  readonly onPress: () => void;
  readonly disabled: boolean;
  readonly ready: boolean;
}) {
  const press = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withSpring(ready ? 1 : 0, tokens.motion.spring.smooth);
  }, [glow, ready]);

  const diskStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.12 }] }));
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: ready ? tokens.overlay.text : tokens.overlay.border,
    transform: [{ scale: 1 + glow.value * 0.04 }],
  }));

  return (
    <PressableScale
      accessibilityLabel="Take photo"
      accessibilityHint="Saves the photo to your history and starts the AI estimate"
      haptic="none"
      disabled={disabled}
      onPressIn={() => {
        press.value = withSpring(1, tokens.motion.spring.snappy);
      }}
      onPressOut={() => {
        press.value = withSpring(0, { damping: 12, stiffness: 300 });
      }}
      onPress={onPress}
    >
      <Animated.View style={[styles.shutterRing, ringStyle]}>
        <Animated.View style={[styles.shutter, diskStyle]} />
      </Animated.View>
    </PressableScale>
  );
}

/** Stand-in for the live camera: the scene drifts a little, like a hand-held phone. */
function SimulatedScene() {
  const reduceMotion = useReducedMotion();
  const sway = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    sway.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(sway);
  }, [reduceMotion, sway]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: 1.12 },
      { translateX: (sway.value - 0.5) * 10 },
      { translateY: (sway.value - 0.5) * -6 },
      { rotate: `${(sway.value - 0.5) * 0.8}deg` },
    ],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image source={previewItem.photo} style={styles.scene} resizeMode="cover" />
    </Animated.View>
  );
}

function Vignette() {
  return (
    <View style={styles.vignette}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="46%" r="75%">
            <Stop offset="0.45" stopColor="black" stopOpacity={0} />
            <Stop offset="1" stopColor="black" stopOpacity={0.72} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#vignette)" />
      </Svg>
    </View>
  );
}

/** Screens outside a navigator (tests, web previews) are always focused. */
function useIsFocusedSafe(): boolean {
  try {
    return useIsFocused();
  } catch {
    return true;
  }
}

const bracketSize = 34;
const bracketStroke = 3.5;
const bracketRadius = 14;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.color.dark.sunken,
    overflow: 'hidden',
  },
  // Explicit size: an absolutely filled image can otherwise keep its intrinsic height.
  scene: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  vignette: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing[4],
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1] + 2,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.overlay.chrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.overlay.border,
  },
  frameArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  frame: {
    width: '64%',
    aspectRatio: 0.92,
  },
  bracket: {
    position: 'absolute',
    width: bracketSize,
    height: bracketSize,
    borderColor: tokens.overlay.text,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: bracketStroke,
    borderLeftWidth: bracketStroke,
    borderTopLeftRadius: bracketRadius,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: bracketStroke,
    borderRightWidth: bracketStroke,
    borderTopRightRadius: bracketRadius,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: bracketStroke,
    borderLeftWidth: bracketStroke,
    borderBottomLeftRadius: bracketRadius,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: bracketStroke,
    borderRightWidth: bracketStroke,
    borderBottomRightRadius: bracketRadius,
  },
  bottom: {
    gap: tokens.spacing[5],
    paddingHorizontal: tokens.spacing[6],
  },
  tipRow: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  galleryButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: tokens.overlay.text,
    overflow: 'hidden',
  },
  galleryThumb: {
    width: '100%',
    height: '100%',
  },
  galleryBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.overlay.chrome,
  },
  shutterRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: tokens.overlay.text,
  },
  flash: {
    backgroundColor: tokens.overlay.text,
    pointerEvents: 'none',
  },
  flyingShot: {
    position: 'absolute',
    top: '20%',
    left: '18%',
    width: '64%',
    aspectRatio: 0.92,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: tokens.overlay.text,
    pointerEvents: 'none',
  },
  flyingImage: {
    width: '100%',
    height: '100%',
  },
});
