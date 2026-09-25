import { useLocalSearchParams, useRouter } from 'expo-router';

import { CompanionChatView } from '@snapworth/shared/features/companion';

export default function WorthyRoute() {
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();

  return (
    <CompanionChatView
      initialQuestion={q}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
      onUseListing={() => router.push('/list/nike-neon-windbreaker')}
    />
  );
}
