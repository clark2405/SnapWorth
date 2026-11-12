import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { closeIntoTag, firstNameOf, openFromTag, useToast } from '@snapworth/shared/components';

import { LoginView, submitAuth, type AuthInput } from '@snapworth/shared/features/auth';
import { useSession, type SessionUser } from '@snapworth/shared/features/session';

import { useGoogleSignIn } from '../../src/google-sign-in';

export default function SignupRoute() {
  const router = useRouter();
  const { startSession } = useSession();
  const toast = useToast();
  // `?return=1` comes from an account prompt: go back to what the person was doing.
  const { return: returning } = useLocalSearchParams<{ return?: string }>();

  // The feed is fetched while you type, so it's ready to unfold out of the tag.
  useEffect(() => router.prefetch('/feed'), [router]);

  const done = async (input?: AuthInput) => {
    let authUser: SessionUser | null = null;

    // Google's callback finishes with no form; a form must be filled in. With a Supabase project
    // nothing here ever starts a local session.
    if (input) {
      const outcome = await submitAuth(input);
      if (outcome.kind === 'invalid') {
        toast.show({ title: 'Check your details', body: outcome.message });
        return;
      }
      if (outcome.kind === 'failed') {
        toast.show({ title: 'Signup failed', body: outcome.message });
        return;
      }
      if (outcome.kind === 'check-email') {
        toast.show({
          title: 'Check your email',
          body: 'We sent you a confirmation link to finish signing up.',
        });
        return;
      }
      authUser = outcome.user;
    }

    await closeIntoTag({
      stamp: input?.mode === 'login' ? 'WELCOME BACK' : 'WELCOME',
      name: firstNameOf(authUser?.user_metadata?.full_name || input?.fullName),
    });
    startSession(authUser);
    if (returning && router.canGoBack()) router.back();
    else router.replace('/feed');
    openFromTag();
  };
  const google = useGoogleSignIn(() => void done());

  return (
    <LoginView
      initialMode="signup"
      onSubmit={done}
      onForgotPassword={() => router.push('/reset-password')}
      onContinueWithGoogle={google}
      onClose={returning && router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
