import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { themedStyles, tokens, useTheme, useThemedStyles } from '../design';
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

export function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  tone = 'neutral',
}: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);

  return (
    <View style={styles.root} accessibilityLiveRegion="polite">
      <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.icon}>
        <Icon
          size={24}
          strokeWidth={1.75}
          color={tone === 'error' ? colors.danger : colors.textSecondary}
        />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(80).duration(420)} style={styles.text}>
        <SWText variant="headingLarge" align="center">
          {title}
        </SWText>
        <SWText variant="bodyMedium" tone="textMuted" align="center">
          {body}
        </SWText>
      </Animated.View>
      {actionLabel ? (
        <Animated.View entering={FadeInDown.delay(160).duration(420)}>
          <Button label={actionLabel} variant="secondary" size="medium" onPress={onAction} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  root: {
    alignItems: 'center',
    gap: tokens.spacing[4],
    paddingVertical: tokens.spacing[12],
    paddingHorizontal: tokens.spacing[4],
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  text: {
    gap: tokens.spacing[2],
    maxWidth: tokens.layout.phoneColumn - tokens.spacing[16],
  },
}));
