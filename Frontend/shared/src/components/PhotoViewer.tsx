import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic, tokens } from '../design';
import { IconButton } from './IconButton';
import { clampOffset, doubleTapZoom, offsetAround, pinchZoom, settledZoom } from './photo-zoom';
import { SWText } from './SWText';

/** One photo of an item, with the words a screen reader says for it. */
export interface ItemPhoto {
  readonly source: ImageSourcePropType;
  readonly label: string;
}

export interface PhotoViewerProps {
  readonly photos: readonly ItemPhoto[];
  /** Which photo opens first. */
  readonly index?: number;
  readonly visible: boolean;
  readonly onClose: () => void;
}

/** How far a photo is dragged down before letting go closes the viewer. */
const dismissDistance = 120;
const settle = { damping: 22, stiffness: 220 };

/**
 * An item's photos, opened full screen to inspect: swipe between them, pinch or double-tap to
 * look closer, drag a photo around once zoomed, and swipe down (or tap close) to put them away.
 */
export function PhotoViewer({ photos, index = 0, visible, onClose }: PhotoViewerProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index);
  const [zoomed, setZoomed] = useState(false);
  const pager = useRef<ScrollView>(null);
  // Swiping a photo down fades the stage, so the page beneath shows through as it goes.
  const drag = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    setCurrent(index);
    setZoomed(false);
    drag.value = 0;
  }, [drag, index, visible]);

  const stageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(drag.value), [0, dismissDistance * 2], [1, 0.35], 'clamp'),
  }));
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(drag.value), [0, dismissDistance * 0.6], [1, 0], 'clamp'),
  }));

  const onPage = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    if (page !== current) {
      setCurrent(page);
      haptic('select');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* A modal is its own window, so gestures inside it need their own root. */}
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.stage, stageStyle]} />
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed && photos.length > 1}
          showsHorizontalScrollIndicator={false}
          // Land on the photo that was tapped once the pager knows its width; an initial offset
          // set before layout can stop short of the page.
          onLayout={() => pager.current?.scrollTo({ x: index * width, y: 0, animated: false })}
          onMomentumScrollEnd={onPage}
          style={styles.fill}
        >
          {photos.map((photo, page) => (
            <ZoomablePhoto
              key={page}
              photo={photo}
              active={page === current}
              drag={drag}
              onZoomChange={setZoomed}
              onDismiss={onClose}
            />
          ))}
        </ScrollView>

        <Animated.View
          pointerEvents="box-none"
          style={[styles.chrome, { paddingTop: insets.top + tokens.spacing[2] }, chromeStyle]}
        >
          <IconButton icon={X} label="Close photos" appearance="overlay" onPress={onClose} />
          {photos.length > 1 ? (
            <View style={styles.counter}>
              <SWText variant="labelSmall" color={tokens.overlay.text}>
                {current + 1} of {photos.length}
              </SWText>
            </View>
          ) : null}
          <View style={styles.balance} />
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function ZoomablePhoto({
  photo,
  active,
  drag,
  onZoomChange,
  onDismiss,
}: {
  readonly photo: ItemPhoto;
  readonly active: boolean;
  readonly drag: SharedValue<number>;
  readonly onZoomChange: (zoomed: boolean) => void;
  readonly onDismiss: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const focusX = useSharedValue(0);
  const focusY = useSharedValue(0);

  // Leaving a photo resets it, so coming back to it starts from the whole picture.
  useEffect(() => {
    if (active) return;
    scale.value = 1;
    x.value = 0;
    y.value = 0;
    setZoomed(false);
  }, [active, scale, x, y]);

  const report = (next: boolean) => {
    setZoomed(next);
    onZoomChange(next);
  };

  // The photo zooms around the point between the fingers, as Photos does, so what you are
  // reaching for stays under them.
  const pinch = Gesture.Pinch()
    .onStart((event) => {
      startScale.value = scale.value;
      startX.value = x.value;
      startY.value = y.value;
      focusX.value = event.focalX;
      focusY.value = event.focalY;
    })
    .onUpdate((event) => {
      const zoom = pinchZoom(startScale.value, event.scale);
      scale.value = zoom;
      // Moving the fingers together while pinching carries the photo along with them.
      x.value =
        offsetAround(focusX.value, width, startX.value, startScale.value, zoom) +
        (event.focalX - focusX.value);
      y.value =
        offsetAround(focusY.value, height, startY.value, startScale.value, zoom) +
        (event.focalY - focusY.value);
    })
    .onEnd(() => {
      const next = settledZoom(scale.value);
      scale.value = withSpring(next, settle);
      x.value = withSpring(clampOffset(x.value, next, width), settle);
      y.value = withSpring(clampOffset(y.value, next, height), settle);
      runOnJS(report)(next > 1.01);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1.01) {
        scale.value = withTiming(1, { duration: tokens.motion.duration.base });
        x.value = withTiming(0, { duration: tokens.motion.duration.base });
        y.value = withTiming(0, { duration: tokens.motion.duration.base });
        runOnJS(report)(false);
      } else {
        // Zoom in on the spot that was tapped.
        const toX = clampOffset(
          offsetAround(event.x, width, 0, 1, doubleTapZoom),
          doubleTapZoom,
          width,
        );
        const toY = clampOffset(
          offsetAround(event.y, height, 0, 1, doubleTapZoom),
          doubleTapZoom,
          height,
        );
        scale.value = withTiming(doubleTapZoom, { duration: tokens.motion.duration.base });
        x.value = withTiming(toX, { duration: tokens.motion.duration.base });
        y.value = withTiming(toY, { duration: tokens.motion.duration.base });
        runOnJS(report)(true);
      }
    });

  // Zoomed in, a drag moves around the photo. At its full size, a vertical drag carries it
  // away; sideways movement is left to the pager so the next photo can come in.
  const pan = zoomed
    ? Gesture.Pan()
        // Two fingers are the pinch's; it moves the photo itself.
        .maxPointers(1)
        .onStart(() => {
          startX.value = x.value;
          startY.value = y.value;
        })
        .onUpdate((event) => {
          x.value = clampOffset(startX.value + event.translationX, scale.value, width);
          y.value = clampOffset(startY.value + event.translationY, scale.value, height);
        })
    : Gesture.Pan()
        .activeOffsetY([-12, 12])
        .failOffsetX([-12, 12])
        .onUpdate((event) => {
          y.value = event.translationY;
          drag.value = event.translationY;
        })
        .onEnd((event) => {
          if (Math.abs(event.translationY) > dismissDistance || Math.abs(event.velocityY) > 900) {
            runOnJS(onDismiss)();
          } else {
            y.value = withSpring(0, settle);
            drag.value = withSpring(0, settle);
          }
        });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const photoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width, height }} collapsable={false}>
        <Animated.View style={[styles.fill, photoStyle]}>
          <Image
            source={photo.source}
            accessibilityRole="image"
            accessibilityLabel={photo.label}
            resizeMode="contain"
            // Sized outright: a bundled image otherwise keeps its own pixel size.
            style={styles.photo}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  stage: {
    backgroundColor: tokens.overlay.stage,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  chrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.layout.pageGutterCompact,
  },
  counter: {
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[1],
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.overlay.chrome,
  },
  // Matches the close button's width, so the counter sits in the true centre.
  balance: {
    width: tokens.focus.minimumTarget,
  },
});
