import { useRouter } from 'expo-router';

import { NotificationsView } from '@snapworth/shared/features/profile';

import { useNotificationSettings } from '../../../src/notifications';

export default function NotificationsRoute() {
  const router = useRouter();
  const settings = useNotificationSettings();

  return (
    <NotificationsView
      {...settings}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
    />
  );
}
