import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { closeIntoTag, firstNameOf, openFromTag, useToast } from '@snapworth/shared/components';

import {
  LoginView,
  isSupabaseConfigured,
  performAuth,
  type AuthInput,
} from '@snapworth/shared/features/auth';
import { useSession, type SessionUser } from '@snapworth/shared/features/session';

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

    if (input?.email && input?.password && isSupabaseConfigured()) {
      try {
        const { data, error } = await performAuth(input);
        if (error) {
          toast.show({ title: 'Signup failed', body: error.message });
          return;
        }
        if (input.mode === 'signup' && !data.session) {
          toast.show({
            title: 'Check your email',
            body: 'We sent you a confirmation link to finish signing up.',
          });
          return;
        }
        authUser = data.user;
      } catch (err) {
        toast.show({
          title: 'Signup failed',
          body: err instanceof Error ? err.message : 'Something went wrong. Try again.',
        });
        return;
      }
    } else if (input) {
      authUser = {
        id: 'local_user',
        email: input.email || 'user@snapworth.com',
        user_metadata: {
          full_name: input.fullName || (input.email ? input.email.split('@')[0] : 'User'),
          gender: input.gender,
        },
        created_at: new Date().toISOString(),
      };
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
