import { useRouter } from 'expo-router';

import { useToast } from '@snapworth/shared/components';
import { deleteAccount } from '@snapworth/shared/features/auth';
import { ProfileView } from '@snapworth/shared/features/profile';
import { AccountGateView, useSession } from '@snapworth/shared/features/session';

export default function ProfileRoute() {
  const router = useRouter();
  const { isGuest, user, endSession } = useSession();
  const toast = useToast();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/feed'));

  if (isGuest) return <AccountGateView title="Profile" intent="profile" onBack={back} />;

  return (
    <ProfileView
      onBack={back}
      onOpen={(destination) => {
        if (destination === 'edit-profile') router.push('/settings/profile');
        if (destination === 'listings') router.push('/history?filter=listed');
        if (destination === 'votes') router.push('/votes');
        if (destination === 'conversations') router.push('/chat');
        if (destination === 'moderation') router.push('/admin/review');
        if (destination === 'introduction') router.push('/onboarding?replay=1');
        if (destination === 'notifications') router.push('/settings/notifications');
        if (destination === 'price-alerts') router.push('/settings/price-alerts');
        if (destination === 'help') router.push('/settings/help');
      }}
      // Logging out leaves a guest who can keep looking around.
      onLogOut={() => {
        endSession();
        router.replace('/feed');
      }}
      // Deletes the account and everything in it on the server, then this device's copy, and
      // leaves a guest who can keep looking around. A failure stays in the sheet with the reason.
      onDeleteAccount={async (typed) => {
        const outcome = await deleteAccount(typed, user?.id);
        if (outcome.kind === 'deleted') {
          endSession();
          toast.show({ title: 'Account deleted', body: 'You can keep looking around.' });
          router.replace('/feed');
        }
        return outcome;
      }}
    />
  );
}
