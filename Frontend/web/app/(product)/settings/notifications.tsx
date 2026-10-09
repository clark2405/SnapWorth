import { useRouter } from 'expo-router';

import { NotificationsView } from '@snapworth/shared/features/profile';

export default function NotificationsRoute() {
  const router = useRouter();

  return (
    <NotificationsView
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
    />
  );
}
