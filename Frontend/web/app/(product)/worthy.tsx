import { useLocalSearchParams, useRouter } from 'expo-router';

import { CompanionChatView } from '@snapworth/shared/features/companion';
import { AccountGateView, useSession } from '@snapworth/shared/features/session';

export default function WorthyRoute() {
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { isGuest } = useSession();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/feed'));

  // Worthy works with your own snaps, listings and chats, so it needs an account.
  if (isGuest) return <AccountGateView title="Worthy" intent="worthy" onBack={back} />;

  return (
    <CompanionChatView
      initialQuestion={q}
      onBack={back}
      onUseListing={() => router.push('/list/nike-neon-windbreaker')}
    />
  );
}
