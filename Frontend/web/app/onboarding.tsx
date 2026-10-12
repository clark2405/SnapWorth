import { useLocalSearchParams, useRouter } from 'expo-router';

import { OnboardingView } from '@snapworth/shared/features/onboarding';

import { markIntroSeen } from '../src/intro-store';

export default function OnboardingRoute() {
  const router = useRouter();
  // Settings reopens the introduction with `?replay=1`; finishing it returns there.
  const { replay } = useLocalSearchParams<{ replay?: string }>();

  if (replay) {
    const close = () => (router.canGoBack() ? router.back() : router.replace('/feed'));
    return <OnboardingView mode="replay" onGetStarted={close} onSkip={close} />;
  }

  // However the introduction is left, it has been seen: later visits open the feed.
  const leave = (href: '/signup' | '/login' | '/feed') => {
    markIntroSeen();
    router.replace(href);
  };

  return (
    <OnboardingView
      onGetStarted={() => leave('/signup')}
      onSignIn={() => leave('/login')}
      // Looking around needs no account; one is asked for when the person first acts.
      onSkip={() => leave('/feed')}
    />
  );
}
