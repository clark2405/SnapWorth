import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { tokens, type SemanticColorName } from '../design';
import { PressableScale } from './PressableScale';

export interface IconButtonProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onPress?: () => void;
  /** `glass` draws the round glass disc; `bare` is just the glyph with a full touch target. */
  readonly appearance?: 'glass' | 'bare' | 'accent';
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
      style={[
        styles.base,
        appearance === 'glass' ? styles.glass : null,
        appearance === 'accent' ? styles.accent : null,
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
  glass: {
    width: 40,
    height: 40,
    backgroundColor: tokens.glass.fillRaised,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.glass.border,
  },
  accent: {
    width: 36,
    height: 36,
    backgroundColor: tokens.color.dark.accent,
  },
});
