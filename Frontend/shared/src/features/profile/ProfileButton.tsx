import { StyleSheet } from 'react-native';

import { Avatar, PressableScale } from '../../components';
import { tokens } from '../../design';
import { previewProfile } from '../preview/sample-data';

/** The signed-in user's avatar in a top-level header; opens the profile and settings. */
export function ProfileButton({ onPress }: { readonly onPress?: () => void }) {
  return (
    <PressableScale
      accessibilityLabel="Your profile and settings"
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.ring, pressed ? styles.pressed : null]}
    >
      <Avatar source={previewProfile.user.avatar} name={previewProfile.user.handle} size={36} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: tokens.focus.minimumTarget,
    height: tokens.focus.minimumTarget,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.borderStrong,
  },
  pressed: {
    borderColor: tokens.color.dark.textPrimary,
  },
});
