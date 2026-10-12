import { Redirect } from 'expo-router';

import { hasSeenIntro } from '../src/intro-store';

// Launch route (SDD 8.1). The first-run introduction plays once per browser; after that, visits
// open the feed, where anyone can look around and an account is asked for only when they act.
export default function RootRoute() {
  return <Redirect href={hasSeenIntro() ? '/feed' : '/onboarding'} />;
}
