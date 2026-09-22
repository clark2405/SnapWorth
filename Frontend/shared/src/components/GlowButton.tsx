import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { tokens, type SemanticColorName } from '../design';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

export type GlowButtonVariant = 'primary' | 'glass' | 'mintGlass' | 'mintOutline';

export interface GlowButtonProps {
  readonly label: string;
  readonly onPress?: () => void;
  readonly variant?: GlowButtonVariant;
  readonly icon?: LucideIcon;
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
  /** Layout for the outer pressable, e.g. `{ flex: 1 }` to fill a row. */
  readonly containerStyle?: StyleProp<ViewStyle>;
}

const labelTone: Record<GlowButtonVariant, SemanticColorName> = {
  primary: 'onAccent',
  glass: 'textPrimary',
  mintGlass: 'accent',
  mintOutline: 'accent',
};

/**
 * The primary action is a mint pill that glows from underneath. Glass and mint-glass pills
 * carry the secondary actions so only one thing on a screen ever glows.
 */
export function GlowButton({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  disabled = false,
  accessibilityHint,
  style,
  containerStyle,
}: GlowButtonProps) {
  const tone: SemanticColorName = disabled ? 'textMuted' : labelTone[variant];
  const glowing = variant === 'primary' && !disabled;

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      containerStyle={containerStyle}
      style={[
        styles.base,
        glowing ? styles.glow : null,
        variant === 'primary' && disabled ? styles.disabled : null,
        variant === 'glass' || variant === 'mintOutline' ? styles.glass : null,
        variant === 'mintGlass' ? styles.mintGlass : null,
        style,
      ]}
    >
      {glowing ? (
        <LinearGradient
          colors={[tokens.glow.mintTop, tokens.glow.mintBottom]}
          style={[StyleSheet.absoluteFill, styles.gradient]}
        />
      ) : null}
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
    borderRadius: tokens.radius.full,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[5],
  },
  gradient: {
    borderRadius: tokens.radius.full,
  },
  glow: {
    boxShadow: tokens.glow.button,
  },
  disabled: {
    backgroundColor: tokens.glass.fillRaised,
  },
  glass: {
    backgroundColor: tokens.glass.fill,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.glass.border,
  },
  mintGlass: {
    backgroundColor: tokens.glass.fillRaised,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.glass.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
  },
});
