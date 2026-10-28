import { useLocalSearchParams, useRouter } from 'expo-router';

import { closeIntoTag, openFromTag } from '@snapworth/shared/components';
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
  const leave = (href: '/signup' | '/login') => {
    markIntroSeen();
    router.replace(href);
  };
  // Looking around plays the same hand-off as signing in: the introduction closes into the tag,
  // the feed opens out of it.
  const lookAround = async () => {
    markIntroSeen();
    await closeIntoTag({
      stamp: 'JUST LOOKING',
      eyebrow: 'Guest pass',
      waiting: 'Opening the feed',
    });
    router.replace('/feed');
    openFromTag();
  };

  return (
    <OnboardingView
      onGetStarted={() => leave('/signup')}
      onSignIn={() => leave('/login')}
      // Looking around needs no account; one is asked for when the person first acts.
      onSkip={() => void lookAround()}
    />
  );
}
