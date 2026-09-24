import { useRouter } from 'expo-router';

import { OnboardingView } from '@snapworth/shared/features/onboarding';

export default function OnboardingRoute() {
  const router = useRouter();

  return (
    <OnboardingView
      onGetStarted={() => router.replace('/signup')}
      onSignIn={() => router.replace('/login')}
      onSkip={() => router.replace('/login')}
    />
  );
}
