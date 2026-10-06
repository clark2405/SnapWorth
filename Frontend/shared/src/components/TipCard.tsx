import type { LucideIcon } from 'lucide-react-native';
import { X } from 'lucide-react-native';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

export interface TipCardProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly message: string;
  readonly onClose: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * A short, in-place tip, the way TipKit teaches: it sits right where the action is, says what
 * to try in a line, and leaves once the person has done it (or closes it).
 */
export function TipCard({ icon: Icon, title, message, onClose, style }: TipCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOut.duration(tokens.motion.duration.fast)}
      layout={LinearTransition}
      style={[styles.card, style]}
      accessibilityRole="summary"
    >
      <View style={styles.icon}>
        <Icon size={18} strokeWidth={2.2} color={colors.accent} />
      </View>
      <View style={styles.text}>
        <SWText variant="label">{title}</SWText>
        <SWText variant="bodySmall" tone="textSecondary">
          {message}
        </SWText>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Close tip"
        haptic="select"
        hitSlop={tokens.spacing[2]}
        onPress={onClose}
        style={styles.close}
      >
        <X size={16} strokeWidth={2.4} color={colors.textMuted} />
      </PressableScale>
    </Animated.View>
  );
}

const stylesFor = themedStyles((colors) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing[3],
    padding: tokens.spacing[4],
    borderRadius: tokens.radius.large,
    backgroundColor: colors.surface,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderSubtle,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  close: {
    padding: 2,
  },
}));
