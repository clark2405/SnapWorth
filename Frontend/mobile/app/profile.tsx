import { useRouter } from 'expo-router';

import { ProfileView } from '@snapworth/shared/features/profile';

export default function ProfileRoute() {
  const router = useRouter();

  return (
    <ProfileView
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
      onOpen={(destination) => {
        // Only moderation has a screen so far; the other settings are not built yet.
        if (destination === 'moderation') router.push('/admin/review');
      }}
      // Preview wiring: there is no session to end yet, so logging out returns to login.
      onLogOut={() => router.replace('/login')}
    />
  );
}
