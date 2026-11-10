import { Link2Off } from 'lucide-react-native';
import Animated from 'react-native-reanimated';

import { Button, NavHeader, Reveal, Screen, stampIn, SWText } from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';

export interface AuthCallbackViewProps {
  /** Why the sign-in didn't finish; while it's finishing, nothing. */
  readonly failure?: string | null;
  readonly onBackToLogin?: () => void;
}

/** Where Google sends people back to: a moment of "Signing you in…", or why it didn't work. */
export function AuthCallbackView({ failure, onBackToLogin }: AuthCallbackViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);

  return (
    <Screen
      ambient="calm"
      quiet
      header={<NavHeader title="" onBack={failure ? onBackToLogin : undefined} />}
      contentStyle={styles.content}
    >
      {failure ? (
        <>
          <Reveal index={0} style={styles.intro}>
            <Animated.View entering={stampIn} style={styles.icon}>
              <Link2Off size={24} strokeWidth={1.75} color={colors.danger} />
            </Animated.View>
            <SWText variant="displayHero" accessibilityRole="header">
              Google sign-in didn’t finish.
            </SWText>
            <SWText variant="bodyLarge" tone="textSecondary" accessibilityLiveRegion="polite">
              {failure}
            </SWText>
          </Reveal>
          <Reveal index={1} style={styles.actions}>
            <Button label="Back to log in" onPress={onBackToLogin} />
          </Reveal>
        </>
      ) : (
        <Reveal index={0} style={styles.intro}>
          <SWText variant="bodyLarge" tone="textSecondary" accessibilityLiveRegion="polite">
            Signing you in…
          </SWText>
        </Reveal>
      )}
    </Screen>
  );
}

const stylesFor = themedStyles((colors) => ({
  content: {
    paddingTop: tokens.spacing[6],
    gap: tokens.spacing[10],
  },
  intro: {
    gap: tokens.spacing[3],
  },
  icon: {
    width: tokens.spacing[12],
    height: tokens.spacing[12],
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
    marginBottom: tokens.spacing[2],
  },
  actions: {
    gap: tokens.spacing[3],
  },
}));
