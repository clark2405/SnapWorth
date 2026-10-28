import { Redirect, type Href } from 'expo-router';

import { useSession } from '@snapworth/shared/features/session';

// Launch route (SDD 8.1). Signed out, every launch opens the introduction, which has its own way
// to sign in; signed in, the app opens on the feed.
//
// In development, `EXPO_PUBLIC_DEV_START_ROUTE` opens a specific screen instead, for reviewing
// one screen at a time on a simulator.
const devStartRoute = __DEV__ ? process.env.EXPO_PUBLIC_DEV_START_ROUTE : undefined;

export default function RootRoute() {
  const { isGuest } = useSession();

  if (devStartRoute) return <Redirect href={devStartRoute as Href} />;
  return <Redirect href={isGuest ? '/onboarding' : '/feed'} />;
}
