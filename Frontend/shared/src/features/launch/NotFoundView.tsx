import { Compass } from 'lucide-react-native';

import { EmptyState, NavHeader, Screen } from '../../components';

export interface NotFoundViewProps {
  /** Where "Back to the feed" goes; the route that owns the router decides how. */
  readonly onGoHome?: () => void;
}

/**
 * What an address that matches no screen shows, in place of the router's own "Unmatched Route"
 * page: Worthy explaining, in the app's own look, with one way back in.
 */
export function NotFoundView({ onGoHome }: NotFoundViewProps) {
  return (
    <Screen ambient="feed" header={<NavHeader title="SnapWorth" banded />}>
      <EmptyState
        icon={Compass}
        title="We can’t find that page"
        body="The link may be out of date, or the page may have moved. The feed is a good place to start again."
        actionLabel="Back to the feed"
        onAction={onGoHome}
      />
    </Screen>
  );
}
