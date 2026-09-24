import { Redirect } from 'expo-router';

// Launch route (SDD 8.1). There is no session service yet, so every launch opens with the
// first-run introduction, which hands off to sign-up or login. Once sessions exist, returning
// users with a completed profile should go straight to the feed.
export default function RootRoute() {
  return <Redirect href="/onboarding" />;
}
