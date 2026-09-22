import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { tokens } from '../design';

export interface PhotoProps {
  readonly source: ImageSourcePropType;
  /** Describes the item, e.g. "Photo of a vintage Polaroid camera". */
  readonly label: string;
  readonly aspectRatio?: number;
  readonly radius?: number;
  readonly style?: StyleProp<ViewStyle>;
}

/** An item photograph. Every screen that shows an item shows its photo. */
export function Photo({
  source,
  label,
  aspectRatio,
  radius = tokens.radius.large,
  style,
}: PhotoProps) {
  return (
    <View style={[styles.frame, { borderRadius: radius, aspectRatio }, style]}>
      <Image
        accessibilityRole="image"
        accessibilityLabel={label}
        source={source}
        resizeMode="cover"
        style={styles.image}
      />
    </View>
  );
}

export interface AvatarProps {
  readonly source: ImageSourcePropType;
  readonly name: string;
  readonly size?: number;
}

export function Avatar({ source, name, size = 36 }: AvatarProps) {
  return (
    <Photo
      source={source}
      label={`${name}'s profile photo`}
      radius={tokens.radius.full}
      style={{ width: size, height: size }}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: tokens.color.dark.surface,
  },
  // Explicit size: on web the image otherwise renders at its natural size inside the frame.
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
});
