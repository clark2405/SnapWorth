import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  type HapticKind,
  type SemanticColorName,
} from '../design';
import { GlassSurface } from './GlassSurface';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

export interface IconButtonProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onPress?: () => void;
  /**
   * `bare` is just the glyph with a full touch target; `tinted` sits on a soft filled circle;
   * `outline` draws a hairline ring; `glass` floats over content (headers, photos); `accent`
   * is a filled send/confirm control; `overlay` sits over live camera media.
   */
  readonly appearance?: 'bare' | 'tinted' | 'outline' | 'glass' | 'accent' | 'overlay';
  readonly tone?: SemanticColorName;
  readonly size?: number;
  /** A small count, e.g. unread messages. */
  readonly badge?: number;
  readonly haptic?: HapticKind;
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  appearance = 'bare',
  tone,
  size = 20,
  badge,
  haptic,
}: IconButtonProps) {
  const { colors, name } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const color =
    appearance === 'overlay'
      ? tokens.overlay.text
      : colors[tone ?? (appearance === 'accent' ? 'onAccent' : 'textPrimary')];
  const glyph = <Icon size={size} strokeWidth={2} color={color} />;

  return (
    <PressableScale
      accessibilityLabel={badge ? `${label}, ${badge} new` : label}
      onPress={onPress}
      hitSlop={4}
      haptic={haptic}
      style={({ pressed }) => [
        styles.base,
        styles[appearance],
        pressed && appearance === 'accent' ? styles.accentPressed : null,
        pressed && (appearance === 'bare' || appearance === 'outline' || appearance === 'tinted')
          ? styles.pressed
          : null,
      ]}
    >
      {appearance === 'glass' ? (
        <GlassSurface interactive tint={tokens.glass[name].fill} style={styles.glassFill}>
          <View style={styles.center}>{glyph}</View>
        </GlassSurface>
      ) : (
        glyph
      )}
      {badge ? (
        <View style={styles.badge}>
          <SWText variant="tabLabel" tone="onAccent">
            {badge > 9 ? '9+' : badge}
          </SWText>
        </View>
      ) : null}
    </PressableScale>
  );
}

const target = tokens.focus.minimumTarget;

const stylesFor = themedStyles((colors) => ({
  base: {
    width: target,
    height: target,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bare: {},
  tinted: {
    backgroundColor: colors.sunken,
  },
  outline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  glass: {},
  glassFill: {
    width: target,
    height: target,
    borderRadius: tokens.radius.full,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    backgroundColor: tokens.overlay.chrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.overlay.border,
  },
  accent: {
    backgroundColor: colors.accent,
  },
  accentPressed: {
    backgroundColor: colors.accentPressed,
  },
  pressed: {
    backgroundColor: colors.borderSubtle,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: tokens.radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
