import {
  Image,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
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

  const imageStyle = useAnimatedStyle(() => ({
    opacity: loaded.value,
    transform: [{ scale: 1.04 - loaded.value * 0.04 }],
  }));

  return (
    <View style={[styles.frame, { borderRadius: radius, aspectRatio }, style]}>
      <AnimatedImage
        accessibilityRole="image"
        accessibilityLabel={label}
        source={source}
        resizeMode="cover"
        onLoad={() => {
          loaded.value = withTiming(1, { duration: 420, easing: Easing.bezier(0.16, 1, 0.3, 1) });
        }}
        style={[styles.image, imageStyle]}
      />
    </View>
  );
}

export interface AvatarProps {
  readonly source: ImageSourcePropType;
  readonly name: string;
  readonly size?: number;
  /** A ring in the accent, e.g. for a verified or top seller. */
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
    borderColor: colors.accent,
  },
}));
