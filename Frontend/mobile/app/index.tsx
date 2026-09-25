import { Redirect, type Href } from 'expo-router';

// Launch route (SDD 8.1). There is no session service yet, so every launch opens with the
// first-run introduction, which hands off to sign-up or login. Once sessions exist, returning
// users with a completed profile should go straight to the feed.
//
// In development, `EXPO_PUBLIC_DEV_START_ROUTE` opens a specific screen instead, for reviewing
// one screen at a time on a simulator.
const devStartRoute = __DEV__ ? process.env.EXPO_PUBLIC_DEV_START_ROUTE : undefined;

export default function RootRoute() {
  return <Redirect href={(devStartRoute || '/onboarding') as Href} />;
}
