import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { useSession } from '@snapworth/shared/features/session';

import { hasSeenIntro } from '../src/intro-store';

// Launch route (SDD 8.1). The first-run introduction plays once per device; after that, launches
// require login before opening the app unless this session is already signed in.
//
// In development, `EXPO_PUBLIC_DEV_START_ROUTE` opens a specific screen instead, for reviewing
// one screen at a time on a simulator.
const devStartRoute = __DEV__ ? process.env.EXPO_PUBLIC_DEV_START_ROUTE : undefined;

export default function RootRoute() {
  const { isGuest } = useSession();
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    void hasSeenIntro().then(setSeen);
  }, []);

  if (devStartRoute) return <Redirect href={devStartRoute as Href} />;
  // The launch screen is still up while this reads, so nothing needs drawing yet.
  if (seen === null) return null;
  return <Redirect href={seen ? (isGuest ? '/login' : '/feed') : '/onboarding'} />;
}
