import { useRouter } from 'expo-router';

import { HelpView } from '@snapworth/shared/features/profile';

export default function HelpRoute() {
  const router = useRouter();

  return (
    <HelpView
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
      onAskWorthy={() => router.push('/worthy')}
      onReplayIntroduction={() => router.push('/onboarding?replay=1')}
    />
  );
}
