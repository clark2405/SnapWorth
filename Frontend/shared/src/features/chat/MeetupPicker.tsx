import { LocateFixed, Minus, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { IconButton, SWText } from '../../components';
import { held, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import {
  frameAt,
  maximumZoom,
  minimumZoom,
  pixelsPerUnit,
  settleCamera,
  type Camera,
} from './meetup-map-geo';
import { MapCredit, MapLayer, PinSticker, pinSize, TagPin } from './MeetupMap';

/** How close in the map must be before a pin can be dropped: a few streets across. */
export const placingZoom = 14;

export interface MeetupPickerProps {
  readonly camera: Camera;
  /** Called when the map settles after a drag, pinch or zoom button. */
  readonly onCameraChange: (camera: Camera) => void;
  /** The name of the place under the pin, worn on a sticker above it. */
  readonly label?: string;
  /** Width over height. */
  readonly aspect: number;
  readonly accessibilityLabel: string;
}

/** Runs inside the pinch gesture, on the UI thread, so it must be a worklet. */
function clamp(value: number, low: number, high: number) {
  'worklet';
  return Math.min(Math.max(value, low), high);
}

/**
 * Pick any spot to meet: drag the map under the pin, pinch or use the buttons to zoom, and the
 * spot under the pin's point is the place. The pin is the app's kraft-and-marigold tag; it lifts
 * while the map moves and settles when it stops. The tiles are laid out twice the size of the
 * window around it, so a drag never shows an empty edge before the map catches up.
 */
export function MeetupPicker({
  camera,
  onCameraChange,
  label,
  aspect,
  accessibilityLabel,
}: MeetupPickerProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const layer = useMemo(() => ({ width: size.width * 2, height: size.height * 2 }), [size]);
  const frame = useMemo(() => frameAt(camera, layer), [camera, layer]);

  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const scale = useSharedValue(1);
  const lifted = useSharedValue(0);

  // A new camera has been laid out, so the live gesture offsets start again from nothing.
  useEffect(() => {
    panX.value = 0;
    panY.value = 0;
    scale.value = 1;
  }, [camera, panX, panY, scale]);

  const commit = (dx: number, dy: number, zoomBy: number) => {
    // What sits under the middle of the view: the map moved by (dx, dy), then scaled around it.
    const units = pixelsPerUnit(camera.zoom) * zoomBy;
    onCameraChange(
      settleCamera({
        center: { x: camera.center.x - dx / units, y: camera.center.y - dy / units },
        zoom: camera.zoom + Math.log2(zoomBy),
      }),
    );
  };

  const lift = (up: boolean) => {
    'worklet';
    lifted.value = reduceMotion
      ? up
        ? 1
        : 0
      : withSpring(up ? 1 : 0, tokens.motion.spring.snappy);
  };

  const pan = Gesture.Pan()
    .minDistance(1)
    .onStart(() => lift(true))
    .onChange((event) => {
      panX.value += event.changeX;
      panY.value += event.changeY;
    })
    .onEnd(() => {
      lift(false);
      runOnJS(commit)(panX.value, panY.value, scale.value);
    });

  const pinch = Gesture.Pinch()
    .onStart(() => lift(true))
    .onChange((event) => {
      scale.value = clamp(scale.value * event.scaleChange, 0.25, 4);
    })
    .onEnd(() => {
      lift(false);
      runOnJS(commit)(panX.value, panY.value, scale.value);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(commit)(0, 0, 2);
    });

  const gestures = Gesture.Simultaneous(pan, pinch, doubleTap);

  const layerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panX.value }, { translateY: panY.value }, { scale: scale.value }],
  }));
  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -10 * lifted.value }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + 0.35 * lifted.value,
    transform: [{ scale: 1 + 0.4 * lifted.value }],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  const zoomTo = (zoom: number) => onCameraChange(settleCamera({ ...camera, zoom }));
  const tooFar = camera.zoom < placingZoom;
  const middle = { left: size.width / 2, top: size.height / 2 };

  return (
    <View style={[styles.frame, held(colors, 3)]}>
      <View
        style={[styles.clip, { aspectRatio: aspect }]}
        onLayout={onLayout}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Drag the map to move the pin. Pinch, double-tap or use the buttons to zoom."
      >
        <GestureDetector gesture={gestures}>
          <View style={styles.touch}>
            {size.width > 0 ? (
              <Animated.View
                style={[
                  styles.layer,
                  {
                    width: layer.width,
                    height: layer.height,
                    left: -size.width / 2,
                    top: -size.height / 2,
                  },
                  layerStyle,
                ]}
              >
                <MapLayer frame={frame} size={layer} />
              </Animated.View>
            ) : null}
          </View>
        </GestureDetector>

        {/* The exact point: a small ink shadow on the ground under the tag's tip. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.ground, { left: middle.left - 7, top: middle.top - 3 }, shadowStyle]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pin,
            { left: middle.left - pinSize.width / 2, top: middle.top - pinSize.height },
            pinStyle,
          ]}
        >
          <TagPin
            width={pinSize.width}
            height={pinSize.height}
            fill={colors.marigold}
            eyelet={colors.mapLand}
          />
        </Animated.View>
        {label && !tooFar && size.width > 0 ? (
          <PinSticker label={label} at={middle} bounds={size} />
        ) : null}

        {tooFar ? (
          <View style={styles.hint} pointerEvents="none">
            <View style={styles.hintEyelet} />
            <SWText variant="overline" tone="kraftInk">
              Zoom in to place the pin
            </SWText>
          </View>
        ) : null}

        <View style={styles.compass} pointerEvents="none">
          <SWText variant="overline" tone="kraftInk">
            N
          </SWText>
        </View>
        <View style={styles.zoom}>
          <IconButton
            icon={Plus}
            label="Zoom in"
            appearance="tinted"
            size={18}
            disabled={camera.zoom >= maximumZoom}
            onPress={() => zoomTo(Math.floor(camera.zoom) + 1)}
          />
          <IconButton
            icon={Minus}
            label="Zoom out"
            appearance="tinted"
            size={18}
            disabled={camera.zoom <= minimumZoom}
            onPress={() => zoomTo(Math.ceil(camera.zoom) - 1)}
          />
          <IconButton
            icon={LocateFixed}
            label="Zoom to the pin"
            appearance="tinted"
            size={18}
            onPress={() => zoomTo(16.5)}
          />
        </View>
        <MapCredit />
      </View>
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  frame: {
    borderRadius: tokens.radius.large,
    backgroundColor: colors.mapLand,
  },
  clip: {
    width: '100%',
    borderRadius: tokens.radius.large - 2,
    overflow: 'hidden',
  },
  touch: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  layer: {
    position: 'absolute',
  },
  ground: {
    position: 'absolute',
    width: 14,
    height: 6,
    borderRadius: 7,
    backgroundColor: colors.heldShadow,
  },
  pin: {
    position: 'absolute',
  },
  hint: {
    position: 'absolute',
    top: tokens.spacing[2],
    left: tokens.spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    paddingVertical: 3,
    paddingLeft: tokens.spacing[2],
    paddingRight: tokens.spacing[3],
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.kraft,
    transform: [{ rotate: `${tokens.tilt.start}deg` }],
    ...held(colors, 2),
  },
  hintEyelet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.heldEdge,
    backgroundColor: colors.mapLand,
  },
  compass: {
    position: 'absolute',
    top: tokens.spacing[2],
    right: tokens.spacing[2],
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.kraft,
    ...held(colors, 2),
  },
  zoom: {
    position: 'absolute',
    right: tokens.spacing[2],
    bottom: tokens.spacing[5],
    gap: tokens.spacing[1],
  },
}));
