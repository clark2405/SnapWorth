import { Redirect } from 'expo-router';

/** The review queue lives in the moderation console on the website now. */
export default function AdminReviewRoute() {
  return <Redirect href="/admin" />;
}
