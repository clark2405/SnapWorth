import { useRouter } from 'expo-router';

import { ModerationConsoleView } from '@snapworth/shared/features/admin';

/** The moderation console: the website's home, where moderators work. */
export default function ModerationConsoleRoute() {
  const router = useRouter();
  return (
    <ModerationConsoleView
      // It's where the website opens, so there's a way back only when something came before it.
      onBack={router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
