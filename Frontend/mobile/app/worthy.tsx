import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { CompanionChatView } from '@snapworth/shared/features/companion';
import { AccountGateView, useSession } from '@snapworth/shared/features/session';

import { ModalSafeArea } from '../src/ModalSafeArea';
import { askWorthy, startWorthyChat, worthyOnDevice } from '../src/snap-sense';

export default function WorthyRoute() {
  const router = useRouter();
  // `about` is the screen Worthy was opened from, so it can answer about that listing or item.
  const { q, about } = useLocalSearchParams<{ q?: string; about?: string }>();
  const { isGuest } = useSession();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/feed'));
  // With Apple Intelligence, Worthy answers the light questions on the phone; each visit starts
  // a fresh conversation. Without it, Worthy answers as it always has.
  const [answer] = useState(() => {
    if (isGuest || !worthyOnDevice()) return undefined;
    startWorthyChat();
    return askWorthy;
  });

  if (isGuest) return <AccountGateView title="Worthy" intent="worthy" onBack={back} />;

  return (
    <ModalSafeArea>
      <CompanionChatView
        initialQuestion={q}
        answer={answer}
        onBack={back}
        about={about}
        onUseListing={(scanId) => router.push(`/list/${scanId}`)}
      />
    </ModalSafeArea>
  );
}
