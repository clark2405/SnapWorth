import { Redirect } from 'expo-router';

// The website is the moderators' console: it opens there, and the console asks for a moderator's
// sign-in. Everyone else uses the phone app, where the introduction plays.
export default function RootRoute() {
  return <Redirect href="/admin" />;
}
