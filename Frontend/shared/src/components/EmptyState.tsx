import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { tokens } from '../design';
import { Button } from './Button';
import { SWText } from './SWText';

export interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly body: string;
  /** One way forward, e.g. "Retry" or "Clear search". */
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  /** `error` tints the icon so a failure never reads like an ordinary empty list. */
  readonly tone?: 'neutral' | 'error';
}

/** What a list says when it has nothing to show, or could not load. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  tone = 'neutral',
}: EmptyStateProps) {
  return (
    <View style={styles.root} accessibilityLiveRegion="polite">
      <View style={styles.icon}>
        <Icon
          size={22}
          strokeWidth={1.75}
          color={tokens.color.dark[tone === 'error' ? 'danger' : 'textSecondary']}
        />
      </View>
      <View style={styles.text}>
        <SWText variant="headingMedium" align="center">
          {title}
        </SWText>
        <SWText variant="bodySmall" tone="textMuted" align="center">
          {body}
        </SWText>
      </View>
      {actionLabel ? <Button label={actionLabel} variant="secondary" onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: tokens.spacing[4],
    paddingVertical: tokens.spacing[12],
    paddingHorizontal: tokens.spacing[4],
  },
  icon: {
    width: tokens.spacing[12],
    height: tokens.spacing[12],
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.borderStrong,
  },
  text: {
    gap: tokens.spacing[1],
    maxWidth: tokens.layout.phoneColumn - tokens.spacing[16],
  },
});
