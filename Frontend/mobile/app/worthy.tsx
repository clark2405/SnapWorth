import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { CompanionChatView } from '@snapworth/shared/features/companion';

import { ModalSafeArea } from '../src/ModalSafeArea';
import { askWorthy, startWorthyChat, worthyOnDevice } from '../src/snap-sense';

export default function WorthyRoute() {
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/feed'));
  // With Apple Intelligence, Worthy answers the light questions on the phone; each visit starts
  // a fresh conversation. Without it, Worthy answers as it always has.
  const [answer] = useState(() => {
    if (!worthyOnDevice()) return undefined;
    startWorthyChat();
    return askWorthy;
  });

  return (
    <ModalSafeArea>
      <CompanionChatView
        initialQuestion={q}
        answer={answer}
        onBack={back}
        onUseListing={() => router.push('/list/nike-neon-windbreaker')}
      />
    </ModalSafeArea>
  );
}
