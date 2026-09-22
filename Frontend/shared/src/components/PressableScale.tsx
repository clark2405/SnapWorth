import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { tokens, useMotionPreference } from '../design';

const useNativeDriver = Platform.OS !== 'web';

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  /** Style for the outer pressable, e.g. to let it stretch inside a row. */
  readonly containerStyle?: StyleProp<ViewStyle>;
}

/** A pressable that answers a touch by settling slightly inward. Skipped under reduced motion. */
export function PressableScale({
  children,
  style,
  containerStyle,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const { reduceMotion } = useMotionPreference();
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    if (reduceMotion) return;
    Animated.timing(scale, {
      toValue,
      duration: tokens.motion.recipe.directResponse.durationMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={containerStyle}
      onPressIn={(event) => {
        animateTo(tokens.motion.press.scale);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(1);
        onPressOut?.(event);
      }}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
