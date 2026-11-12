import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

import { NewPasswordView, saveNewPassword, useRecoveryLink } from '@snapworth/shared/features/auth';

/**
 * Where a password-reset email's link opens the app. The router keeps only the path, so the
 * tokens on the link are read from the link itself.
 */
export default function NewPasswordRoute() {
  const router = useRouter();
  const { status, retry } = useRecoveryLink(Linking.useLinkingURL());

  return (
    <NewPasswordView
      link={status}
      onSave={saveNewPassword}
      onRetry={retry}
      onRequestNewLink={() => router.replace('/reset-password')}
      onBackToLogin={() => router.replace('/login')}
      onDone={() => router.replace('/feed')}
    />
  );
}
