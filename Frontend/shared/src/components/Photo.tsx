import { useEffect, useState } from 'react';
import {
  Image,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { themedStyles, tokens, useThemedStyles } from '../design';

export interface PhotoProps {
  readonly source: ImageSourcePropType;
  /** Describes the item, e.g. "Photo of a vintage Polaroid camera". */
  readonly label: string;
  readonly aspectRatio?: number;
  readonly radius?: number;
  readonly style?: StyleProp<ViewStyle>;
}

const AnimatedImage = Animated.createAnimatedComponent(Image);

/** The latest a photo shows in full, loaded or not. */
const developFallbackMs = 1500;

/**
 * An item photograph. It develops in rather than popping: a short fade with a slight settle
 * from 104%, like a print coming into focus. Every screen that shows an item shows its photo.
 */
export function Photo({
  source,
  label,
  aspectRatio,
  radius = tokens.radius.medium,
  style,
}: PhotoProps) {
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const loaded = useSharedValue(reduceMotion ? 1 : 0);
  // Once developed, the photo drops its animated style and renders plainly. A fade can fail to
  // reach the screen (a photo loading while its screen is hidden, or while a sheet is still
  // sliding in), so the finished state is committed through React, where it can't be lost.
  // The timer also covers a load event that never arrives.
  const [developed, setDeveloped] = useState(reduceMotion);
  useEffect(() => {
    if (developed) return;
    const fallback = setTimeout(() => setDeveloped(true), developFallbackMs);
    return () => clearTimeout(fallback);
  }, [developed]);

  const imageStyle = useAnimatedStyle(() => ({
    opacity: loaded.value,
    transform: [{ scale: 1.04 - loaded.value * 0.04 }],
  }));

  // Detaching an animated style does not clear its last native opacity. A fresh
  // Image guarantees that a missed fade cannot leave the photo invisible.
  const ImageComponent = developed ? Image : AnimatedImage;

  return (
    <View style={[styles.frame, { borderRadius: radius, aspectRatio }, style]}>
      <ImageComponent
        key={developed ? 'developed' : 'developing'}
        accessibilityRole="image"
        accessibilityLabel={label}
        source={source}
        resizeMode="cover"
        onLoad={() => {
          if (developed) return;
          loaded.value = withTiming(
            1,
            { duration: 420, easing: Easing.bezier(0.16, 1, 0.3, 1) },
            (finished) => {
              if (finished) runOnJS(setDeveloped)(true);
            },
          );
        }}
        style={developed ? styles.image : [styles.image, imageStyle]}
      />
    </View>
  );
}

export interface AvatarProps {
  readonly source: ImageSourcePropType;
  readonly name: string;
  readonly size?: number;
  /** A sand ring, e.g. for a verified or top seller. */
  readonly ring?: boolean;
}

export function Avatar({ source, name, size = 36, ring = false }: AvatarProps) {
  const styles = useThemedStyles(stylesFor);
  const photo = (
    <Photo
      source={source}
      label={`${name}'s profile photo`}
      radius={tokens.radius.full}
      style={{ width: size, height: size }}
    />
  );
  if (!ring) return photo;
  return <View style={[styles.ring, { borderRadius: size }]}>{photo}</View>;
}

const stylesFor = themedStyles((colors) => ({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.sunken,
  },
  // Explicit size: on web the image otherwise renders at its natural size inside the frame.
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  ring: {
    padding: 2,
    borderWidth: 1.5,
    borderColor: colors.sandInk,
  },
}));
