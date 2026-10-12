import { useLocalSearchParams, useRouter } from 'expo-router';

import { CompanionChatView } from '@snapworth/shared/features/companion';

import { ModalSafeArea } from '../src/ModalSafeArea';

export default function WorthyRoute() {
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();

  return (
    <ModalSafeArea>
      <CompanionChatView
        initialQuestion={q}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
        onUseListing={() => router.push('/list/nike-neon-windbreaker')}
      />
    </ModalSafeArea>
  );
}
