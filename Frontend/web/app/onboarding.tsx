import { useLocalSearchParams, useRouter } from 'expo-router';

import { OnboardingView } from '@snapworth/shared/features/onboarding';

export default function OnboardingRoute() {
  const router = useRouter();
  // Settings reopens the introduction with `?replay=1`; finishing it returns there.
  const { replay } = useLocalSearchParams<{ replay?: string }>();

  if (replay) {
    const close = () => (router.canGoBack() ? router.back() : router.replace('/feed'));
    return <OnboardingView mode="replay" onGetStarted={close} onSkip={close} />;
  }

  return (
    <OnboardingView
      onGetStarted={() => router.replace('/signup')}
      onSignIn={() => router.replace('/login')}
      onSkip={() => router.replace('/login')}
    />
  );
}
