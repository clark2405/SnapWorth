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

  // However the introduction is left, later launches go straight to the account step.
  const leave = (href: '/signup' | '/login') => {
    void markIntroSeen();
    router.replace(href);
  };

  return (
    <OnboardingView
      onGetStarted={() => leave('/signup')}
      onSignIn={() => leave('/login')}
      onSkip={() => leave('/login')}
    />
  );
}
