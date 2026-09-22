import { Redirect } from 'expo-router';

// Launch route (SDD 8.1). There is no session service yet, so every visit starts at login.
export default function RootRoute() {
  return <Redirect href="/login" />;
}
