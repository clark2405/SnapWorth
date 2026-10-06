import type { LucideIcon } from 'lucide-react-native';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { themedStyles, tokens, useTheme, useThemedStyles, type SemanticColorName } from '../design';
import { SWText } from './SWText';

export interface OverlineProps {
  readonly label: string;
  /** A small line icon that leads the label, drawn in the label's colour. */
  readonly icon?: LucideIcon;
  /** An urgent count after a "·", e.g. "2 unread": the one place text may wear the accent. */
  readonly count?: string;
  readonly tone?: SemanticColorName;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * The small uppercase line that sits above titles and sections, led by a thin line icon rather
 * than an emoji, so it renders identically on every platform.
 */
export function Overline({ label, icon: Icon, count, tone = 'textMuted', style }: OverlineProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);

  return (
    <View style={[styles.row, style]} accessibilityRole="header">
      {Icon ? <Icon size={14} strokeWidth={2} color={colors[tone]} /> : null}
      <SWText variant="overline" tone={tone} numberOfLines={1} style={styles.label}>
        {label}
        {count ? (
          <>
            <SWText variant="overline" tone={tone}>
              {'  ·  '}
            </SWText>
            <SWText variant="overline" tone="accent">
              {count}
            </SWText>
          </>
        ) : null}
      </SWText>
    </View>
  );
}

const stylesFor = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2] - 2,
  },
  label: {
    flexShrink: 1,
  },
}));
