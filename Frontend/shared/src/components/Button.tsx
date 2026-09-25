import type { LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  type HapticKind,
  type SemanticColorName,
} from '../design';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

/**
 * `primary` is the one monochrome action on a screen; `accent` is reserved for value moments
 * (get the estimate, list for sale); `secondary` is a quiet filled pill; `tertiary` is bare
 * text; `danger` marks destructive actions outside a confirmation.
 */
export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'tertiary' | 'danger';

export interface ButtonProps {
  readonly label: string;
  readonly onPress?: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: 'large' | 'medium' | 'small';
  readonly icon?: LucideIcon;
  readonly disabled?: boolean;
  /** Swaps the label for a pulse while work is in flight; the button stays its size. */
  readonly loading?: boolean;
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
  /** Layout for the outer pressable, e.g. `{ flex: 1 }` to fill a row. */
  readonly containerStyle?: StyleProp<ViewStyle>;
  readonly haptic?: HapticKind;
}

const labelTone: Record<ButtonVariant, SemanticColorName> = {
  primary: 'onInverse',
  accent: 'onAccent',
  secondary: 'textPrimary',
  tertiary: 'accent',
  danger: 'danger',
};

const heights = { large: tokens.layout.controlHeight, medium: 44, small: 34 } as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  icon: Icon,
  disabled = false,
  loading = false,
  accessibilityHint,
  style,
  containerStyle,
  haptic,
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const tone: SemanticColorName = disabled ? 'textMuted' : labelTone[variant];

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      haptic={haptic ?? (variant === 'accent' ? 'pop' : 'tap')}
      containerStyle={containerStyle}
      style={({ pressed }) => [
        styles.base,
        { minHeight: heights[size], paddingHorizontal: size === 'small' ? 14 : tokens.spacing[5] },
        styles[variant],
        pressed ? styles[`${variant}Pressed`] : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={styles.row}
        >
          <PulseDots color={colors[tone]} />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(180)} style={styles.row}>
          {Icon ? (
            <Icon size={size === 'small' ? 15 : 18} strokeWidth={2.2} color={colors[tone]} />
          ) : null}
          <SWText
            variant={size === 'small' ? 'labelSmall' : 'button'}
            tone={tone}
            numberOfLines={1}
          >
            {label}
          </SWText>
        </Animated.View>
      )}
    </PressableScale>
  );
}

function PulseDots({ color }: { readonly color: string }) {
  return (
    <View style={dotStyles.row}>
      {[0, 1, 2].map((index) => (
        <PulseDot key={index} index={index} color={color} />
      ))}
    </View>
  );
}

function PulseDot({ index, color }: { readonly index: number; readonly color: string }) {
  const reduceMotion = useReducedMotion();
  const level = useSharedValue(0.35);

  useEffect(() => {
    if (reduceMotion) return;
    level.value = withDelay(
      index * 140,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
          withTiming(0.35, { duration: 420, easing: Easing.in(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [index, level, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: level.value,
    transform: [{ translateY: (1 - level.value) * 2 }],
  }));

  return <Animated.View style={[dotStyles.dot, { backgroundColor: color }, style]} />;
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, height: 22, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
});

const stylesFor = themedStyles((colors) => ({
  base: {
    borderRadius: tokens.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
  },
  primary: { backgroundColor: colors.inverse },
  primaryPressed: { backgroundColor: colors.inversePressed },
  accent: { backgroundColor: colors.accent },
  accentPressed: { backgroundColor: colors.accentPressed },
  secondary: { backgroundColor: colors.sunken },
  secondaryPressed: { backgroundColor: colors.borderSubtle },
  tertiary: { paddingHorizontal: tokens.spacing[2] },
  tertiaryPressed: { opacity: 0.6 },
  danger: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
  },
  dangerPressed: { backgroundColor: colors.sunken },
  disabled: {
    backgroundColor: colors.sunken,
    borderColor: colors.borderSubtle,
  },
}));
