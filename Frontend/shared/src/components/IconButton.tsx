import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { tokens, type SemanticColorName } from '../design';
import { PressableScale } from './PressableScale';

export interface IconButtonProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onPress?: () => void;
  /**
   * `bare` is just the glyph with a full touch target; `outline` draws a hairline ring;
   * `accent` is a filled send/confirm control; `overlay` sits over live camera media.
   */
  readonly appearance?: 'bare' | 'outline' | 'accent' | 'overlay';
  readonly tone?: SemanticColorName;
  readonly size?: number;
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  appearance = 'bare',
  tone,
  size = 22,
}: IconButtonProps) {
  const color = tokens.color.dark[tone ?? (appearance === 'accent' ? 'onAccent' : 'textPrimary')];

  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        styles[appearance],
        pressed && appearance === 'accent' ? styles.accentPressed : null,
        pressed && appearance !== 'accent' ? styles.pressed : null,
      ]}
    >
      <Icon size={size} strokeWidth={2} color={color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: tokens.focus.minimumTarget,
    height: tokens.focus.minimumTarget,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bare: {},
  outline: {
    borderWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.borderStrong,
  },
  overlay: {
    backgroundColor: tokens.overlay.chrome,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.overlay.border,
  },
  accent: {
    borderRadius: tokens.radius.medium,
    backgroundColor: tokens.color.dark.accent,
  },
  accentPressed: {
    backgroundColor: tokens.color.dark.accentPressed,
  },
  pressed: {
    backgroundColor: tokens.color.dark.surfaceRaised,
  },
});
