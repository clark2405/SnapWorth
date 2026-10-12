import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { held, placeColors, themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import { Button } from './Button';
import { useScreenScroll } from './Screen';
import { SWText } from './SWText';
import { Worthy } from './Worthy';

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
  const place = useScreenScroll()?.place;
  // Worthy stands on a disc of the place's colour, or marigold outside one.
  const disc = place ? placeColors(colors, place).fill : colors.marigold;

  return (
    <View style={styles.root} accessibilityLiveRegion="polite">
      {/* An empty screen is Worthy's to explain, holding up a tag with what belongs here. A
          failure keeps the plain red mark: nothing about it should look cheerful. */}
      {tone === 'error' ? (
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.icon}>
          <Icon size={24} strokeWidth={1.75} color={colors.danger} />
        </Animated.View>
      ) : (
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.worthy}>
          <View style={[styles.disc, { backgroundColor: disc }]} />
          <Worthy size={84} mood="attentive" />
          <View style={styles.held}>
            <Icon size={16} strokeWidth={2} color={colors.kraftInk} />
          </View>
        </Animated.View>
      )}
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
  worthy: {
    width: 120,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    ...held(colors),
  },
  // A little manila tag tucked against Worthy, carrying the screen's own icon.
  held: {
    position: 'absolute',
    right: 0,
    bottom: 4,
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.kraft,
    ...held(colors, 2),
    transform: [{ rotate: `${tokens.tilt.end}deg` }],
  },
  text: {
    gap: tokens.spacing[2],
    maxWidth: tokens.layout.phoneColumn - tokens.spacing[16],
  },
}));
