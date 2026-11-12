import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createLocalFeedRepository } from '../../adapters/local/feed-repository';
import { FeedProvider } from './feed-state';

it('mounts above the session, where the shells put the services', () => {
  // AppServicesProvider (and so FeedProvider) sits outside SessionProvider in both shells; the
  // provider once asked for the session and crashed the app before its first screen.
  render(
    <FeedProvider repository={createLocalFeedRepository({ viewerHandle: 'viewer' })}>
      <Text>mounted</Text>
    </FeedProvider>,
  );

  expect(screen.getByText('mounted')).toBeOnTheScreen();
});
