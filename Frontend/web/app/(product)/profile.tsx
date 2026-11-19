import { useRouter } from 'expo-router';

import { useToast } from '@snapworth/shared/components';
import { deleteAccount } from '@snapworth/shared/features/auth';
import { ProfileView } from '@snapworth/shared/features/profile';
import { useSession } from '@snapworth/shared/features/session';

/**
 * The moderator's own account on the website: who's signed in, the look, the console, help and
 * signing out. Their scans, listings, votes and chats are in the phone app (BrowseOnly hides them).
 */
export default function ProfileRoute() {
  const router = useRouter();
  const { user, endSession } = useSession();
  const toast = useToast();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/admin'));

  return (
    <ProfileView
      onBack={back}
      onOpen={(destination) => {
        if (destination === 'edit-profile') router.push('/settings/profile');
        if (destination === 'moderation') router.push('/admin');
        if (destination === 'help') router.push('/settings/help');
      }}
      onLogOut={() => {
        endSession();
        router.replace('/login');
      }}
      // Deletes the account and everything in it on the server; a failure stays in the sheet.
      onDeleteAccount={async (typed) => {
        const outcome = await deleteAccount(typed, user?.id);
        if (outcome.kind === 'deleted') {
          endSession();
          toast.show({ title: 'Account deleted' });
          router.replace('/login');
        }
        return outcome;
      }}
    />
  );
}
