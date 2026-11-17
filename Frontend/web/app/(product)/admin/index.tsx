import { useRouter } from 'expo-router';

import { ModerationConsoleView } from '@snapworth/shared/features/admin';

/** The moderation console: the website is where moderators work. */
export default function ModerationConsoleRoute() {
  const router = useRouter();
  return (
    <ModerationConsoleView
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
    />
  );
}
