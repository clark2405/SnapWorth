import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic, themedStyles, tokens, useThemedStyles } from '../design';
import { SWText } from './SWText';

export interface SheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly children: ReactNode;
}

/**
 * A card that rises from the bottom edge on a spring and follows the finger when dragged; let
 * go past a third of its height (or flick) and it falls away. The backdrop dims in step with it.
 */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const styles = useThemedStyles(stylesFor);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const [height, setHeight] = useState(600);
  const offset = useSharedValue(800);
  const dim = useSharedValue(0);
  const needsPresent = useRef(visible);

  useEffect(() => {
    if (visible) {
      needsPresent.current = true;
      setMounted(true);
      haptic('tap');
    } else if (mounted) {
      dim.value = withTiming(0, { duration: 200 });
      offset.value = withTiming(
        height + 40,
        { duration: 240, easing: Easing.bezier(0.7, 0, 0.84, 0) },
        (done) => {
          if (done) runOnJS(setMounted)(false);
        },
      );
    }
  }, [dim, height, mounted, offset, visible]);

  const present = (measured: number) => {
    setHeight(measured);
    if (!visible) return;
    offset.value = measured + 40;
    dim.value = withTiming(1, { duration: 240 });
    offset.value = reduceMotion
      ? withTiming(0, { duration: 180 })
      : withSpring(0, tokens.motion.spring.smooth);
  };

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onChange((event) => {
      offset.value = Math.max(event.translationY * (event.translationY < 0 ? 0.2 : 1), -24);
      dim.value = 1 - Math.min(1, Math.max(0, event.translationY) / height);
    })
    .onEnd((event) => {
      if (event.translationY > height / 3 || event.velocityY > 900) {
        runOnJS(onClose)();
      } else {
        offset.value = withSpring(0, tokens.motion.spring.snappy);
        dim.value = withTiming(1, { duration: 160 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  if (!mounted) return null;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.sheet, { paddingBottom: insets.bottom + tokens.spacing[4] }, sheetStyle]}
            onLayout={(event) => {
              if (!needsPresent.current) return;
              needsPresent.current = false;
              present(event.nativeEvent.layout.height);
            }}
          >
            <View style={styles.grabber} />
            {title ? (
              <SWText variant="headingLarge" style={styles.title} accessibilityRole="header">
                {title}
              </SWText>
            ) : null}
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const stylesFor = themedStyles((colors) => ({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: tokens.overlay.scrim,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: tokens.radius.xlarge + 4,
    borderTopRightRadius: tokens.radius.xlarge + 4,
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingTop: tokens.spacing[2],
    gap: tokens.spacing[4],
    width: '100%',
    maxWidth: tokens.layout.phoneColumn,
    alignSelf: 'center',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    marginBottom: tokens.spacing[1],
  },
  title: {
    marginTop: tokens.spacing[1],
  },
}));
