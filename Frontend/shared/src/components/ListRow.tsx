import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { themedStyles, tokens, useTheme, useThemedStyles, type SemanticColorName } from '../design';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

export interface ListRowProps {
  readonly label: string;
  readonly icon?: LucideIcon;
  /** Tint for the icon tile; defaults to a quiet neutral. */
  readonly iconTone?: SemanticColorName;
  readonly value?: string;
  readonly detail?: string;
  readonly trailing?: ReactNode;
  readonly onPress?: () => void;
  readonly destructive?: boolean;
}

/** One row of a grouped list, in the manner of Settings: icon tile, label, value, chevron. */
export function ListRow({
  label,
  icon: Icon,
  iconTone,
  value,
  detail,
  trailing,
  onPress,
  destructive,
}: ListRowProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const body = (
    <>
      {Icon ? (
        <View style={[styles.tile, iconTone ? { backgroundColor: colors[iconTone] } : null]}>
          <Icon
            size={17}
            strokeWidth={2.2}
            color={iconTone ? colors.onAccent : colors.textPrimary}
          />
        </View>
      ) : null}
      <View style={styles.text}>
        <SWText variant="bodyLarge" tone={destructive ? 'danger' : 'textPrimary'}>
          {label}
        </SWText>
        {detail ? (
          <SWText variant="caption" tone="textMuted">
            {detail}
          </SWText>
        ) : null}
      </View>
      {value ? (
        <SWText variant="bodyMedium" tone="textMuted">
          {value}
        </SWText>
      ) : null}
      {trailing}
      {onPress && !trailing ? (
        <ChevronRight size={18} strokeWidth={2} color={colors.textMuted} />
      ) : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <PressableScale
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      depth="surface"
      haptic="select"
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      {body}
    </PressableScale>
  );
}

/** A rounded group of rows with hairline separators inset past the icon tile. */
export function ListGroup({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title?: string;
}) {
  const styles = useThemedStyles(stylesFor);
  const rows = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={styles.groupWrap}>
      {title ? (
        <SWText variant="overline" tone="textMuted" style={styles.groupTitle}>
          {title}
        </SWText>
      ) : null}
      <View style={styles.group}>
        {rows.map((row, index) => (
          <View key={index}>
            {index > 0 ? <View style={styles.separator} /> : null}
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[2],
  },
  pressed: {
    backgroundColor: colors.sunken,
  },
  tile: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  text: {
    flex: 1,
  },
  groupWrap: {
    gap: tokens.spacing[2],
  },
  groupTitle: {
    paddingHorizontal: tokens.spacing[4],
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: tokens.radius.large,
    overflow: 'hidden',
    borderWidth: colors.canvas === colors.sunken ? 0 : StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
    marginLeft: tokens.spacing[4] + 30 + tokens.spacing[3],
    opacity: 0.7,
  },
}));
