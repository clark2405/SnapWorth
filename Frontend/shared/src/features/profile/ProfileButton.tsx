import { Avatar, PressableScale } from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import { previewProfile } from '../preview/sample-data';

/** The signed-in user's avatar in a top-level header; opens the profile and settings. */
export function ProfileButton({ onPress }: { readonly onPress?: () => void }) {
  const styles = useThemedStyles(stylesFor);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Your profile and settings"
      haptic="select"
      onPress={onPress}
      hitSlop={4}
      style={styles.ring}
    >
      <Avatar source={previewProfile.user.avatar} name={previewProfile.user.handle} size={36} />
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
