import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { tokens, type SemanticColorName } from '../design';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

/**
 * `primary` is the one filled lime action on a screen. `secondary` is outlined and `tertiary` is
 * bare text, so a screen never has two things competing to be pressed first. `danger` is an
 * outline for destructive actions outside a confirmation.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';

export interface ButtonProps {
  readonly label: string;
  readonly onPress?: () => void;
  readonly variant?: ButtonVariant;
  readonly icon?: LucideIcon;
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
  /** Layout for the outer pressable, e.g. `{ flex: 1 }` to fill a row. */
  readonly containerStyle?: StyleProp<ViewStyle>;
}

const labelTone: Record<ButtonVariant, SemanticColorName> = {
  primary: 'onAccent',
  secondary: 'textPrimary',
  tertiary: 'textPrimary',
  danger: 'danger',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  disabled = false,
  accessibilityHint,
  style,
  containerStyle,
}: ButtonProps) {
  const tone: SemanticColorName = disabled ? 'textMuted' : labelTone[variant];

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      containerStyle={containerStyle}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && variant === 'primary' ? styles.primaryPressed : null,
        pressed && variant !== 'primary' ? styles.quietPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <View style={styles.row}>
        {Icon ? <Icon size={18} strokeWidth={2} color={tokens.color.dark[tone]} /> : null}
        <SWText variant="button" tone={tone}>
          {label}
        </SWText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: tokens.layout.controlHeight,
    borderRadius: tokens.radius.medium,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[5],
    borderWidth: tokens.border.hairline,
    borderColor: 'transparent',
  },
  primary: {
    backgroundColor: tokens.color.dark.accent,
    borderColor: tokens.color.dark.accent,
  },
  primaryPressed: {
    backgroundColor: tokens.color.dark.accentPressed,
    borderColor: tokens.color.dark.accentPressed,
  },
  secondary: {
    borderColor: tokens.color.dark.borderStrong,
  },
  tertiary: {
    paddingHorizontal: tokens.spacing[2],
  },
  danger: {
    borderColor: tokens.color.dark.danger,
  },
  quietPressed: {
    backgroundColor: tokens.color.dark.surfaceRaised,
  },
  disabled: {
    backgroundColor: tokens.color.dark.surface,
    borderColor: tokens.color.dark.borderSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
  },
});
