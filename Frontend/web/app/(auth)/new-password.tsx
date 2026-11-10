import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { NewPasswordView, saveNewPassword, useRecoveryLink } from '@snapworth/shared/features/auth';

import { authRedirect, forgetAuthRedirect } from '../../src/auth-links';

/** Where a password-reset email's link opens: checks the link, then takes the new password. */
export default function NewPasswordRoute() {
  const router = useRouter();
  // The link's tokens are read once, then wiped from the address bar.
  const [url] = useState(authRedirect);
  useEffect(forgetAuthRedirect, []);
  const { status, retry } = useRecoveryLink(url);

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
