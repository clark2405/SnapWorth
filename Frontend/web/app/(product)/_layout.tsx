import { Stack } from 'expo-router';

import { useTheme } from '@snapworth/shared/design';

/**
 * The app behind the launch and sign-in screens. Screens opened from a tab stack over the tabs,
 * so going back returns to the tab as it was.
 */
export default function ProductLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
        animation: 'fade',
      }}
    />
  );
}
