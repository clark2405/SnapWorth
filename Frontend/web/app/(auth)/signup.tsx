import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { closeIntoTag, firstNameOf, openFromTag } from '@snapworth/shared/components';

import { LoginView, type AuthInput } from '@snapworth/shared/features/auth';
import { useSession } from '@snapworth/shared/features/session';

export default function SignupRoute() {
  const router = useRouter();
  const { startSession } = useSession();
  // `?return=1` comes from an account prompt: go back to what the person was doing.
  const { return: returning } = useLocalSearchParams<{ return?: string }>();

  // The feed is fetched while you type, so it's ready to unfold out of the tag.
  useEffect(() => router.prefetch('/feed'), [router]);

  // Preview wiring: there is no auth service yet, so submitting just starts a session. The screen
  // closes into Worthy's tag first, and the tag opens onto the app.
  const done = async (input?: AuthInput) => {
    await closeIntoTag({
      stamp: input?.mode === 'login' ? 'WELCOME BACK' : 'WELCOME',
      name: firstNameOf(input?.fullName),
    });
    startSession();
    if (returning && router.canGoBack()) router.back();
    else router.replace('/feed');
    openFromTag();
  };

  return (
    <LoginView
      initialMode="signup"
      onSubmit={done}
      onForgotPassword={() => router.push('/reset-password')}
      onContinueWithApple={() => done()}
      onContinueWithGoogle={() => done()}
      onClose={returning && router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
