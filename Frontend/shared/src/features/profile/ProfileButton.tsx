import { UserRound } from 'lucide-react-native';

import { Avatar, PressableScale, useScreenScroll } from '../../components';
import { placeColors, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import { previewProfile } from '../preview/sample-data';
import { useAccountGate, useSession } from '../session';

/**
 * The signed-in user's avatar in a top-level header; opens the profile and settings. A guest
 * sees a plain person mark that offers an account instead.
 */
export function ProfileButton({ onPress }: { readonly onPress?: () => void }) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const { isGuest } = useSession();
  const requireAccount = useAccountGate();
  // On a tab's colour block the ring and mark take the block's ink, so they keep their contrast.
  const place = useScreenScroll()?.place;
  const ink = place ? placeColors(colors, place).ink : null;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={isGuest ? 'Sign in or create an account' : 'Your profile and settings'}
      haptic="select"
      onPress={() => requireAccount('profile', onPress)}
      hitSlop={4}
      style={[styles.ring, ink ? { borderColor: ink, borderWidth: 1.5 } : null]}
    >
      {isGuest ? (
        <UserRound size={20} strokeWidth={2} color={ink ?? colors.textSecondary} />
      ) : (
        <Avatar source={previewProfile.user.avatar} name={previewProfile.user.handle} size={36} />
      )}
    </PressableScale>
  );
}

const stylesFor = themedStyles((colors) => ({
  ring: {
    width: tokens.focus.minimumTarget,
    height: tokens.focus.minimumTarget,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderStrong,
  },
}));
