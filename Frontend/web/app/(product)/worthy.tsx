import { useLocalSearchParams, useRouter } from 'expo-router';

import { CompanionChatView } from '@snapworth/shared/features/companion';
import { AccountGateView, useSession } from '@snapworth/shared/features/session';

export default function WorthyRoute() {
  const router = useRouter();
  // `about` is the screen Worthy was opened from, so it can answer about that listing or item.
  const { q, about } = useLocalSearchParams<{ q?: string; about?: string }>();
  const { isGuest } = useSession();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/feed'));

  // Worthy works with your own snaps, listings and chats, so it needs an account.
  if (isGuest) return <AccountGateView title="Worthy" intent="worthy" onBack={back} />;

  return (
    <CompanionChatView
      initialQuestion={q}
      onBack={back}
      about={about}
      onUseListing={(scanId) => router.push(`/list/${scanId}`)}
    />
  );
}
