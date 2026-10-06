import { useRouter } from 'expo-router';

import { useToast } from '@snapworth/shared/components';
import { ProfileView } from '@snapworth/shared/features/profile';
import { AccountGateView, useSession } from '@snapworth/shared/features/session';

export default function ProfileRoute() {
  const router = useRouter();
  const { isGuest, endSession } = useSession();
  const toast = useToast();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/feed'));

  if (isGuest) return <AccountGateView title="Profile" intent="profile" onBack={back} />;

  return (
    <ProfileView
      onBack={back}
      onOpen={(destination) => {
        // Settings screens (notifications, price alerts, help) are not built yet.
        if (destination === 'listings') router.push('/history?filter=listed');
        if (destination === 'votes') router.push('/votes');
        if (destination === 'conversations') router.push('/chat');
        if (destination === 'moderation') router.push('/admin/review');
        if (destination === 'introduction') router.push('/onboarding?replay=1');
      }}
      // Logging out leaves a guest who can keep looking around.
      onLogOut={() => {
        endSession();
        router.replace('/feed');
      }}
      // Preview wiring: there is no account service yet, so deleting ends the session and leaves
      // a guest. Once it exists, this must also erase the account and its data on the server.
      onDeleteAccount={() => {
        endSession();
        toast.show({ title: 'Account deleted', body: 'You can keep looking around.' });
        router.replace('/feed');
      }}
    />
  );
}
