import { useRouter } from 'expo-router';

import { NotFoundView } from '@snapworth/shared/features/launch';

/** An address that matches no screen. Expo Router shows this instead of its "Unmatched Route" page. */
export default function NotFoundRoute() {
  const router = useRouter();
  return <NotFoundView onGoHome={() => router.replace('/feed')} />;
}
