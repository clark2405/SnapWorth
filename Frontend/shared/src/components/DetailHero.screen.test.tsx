import { screen } from '@testing-library/react-native';
import { Children, type ReactNode } from 'react';
import { Text } from 'react-native';

import { renderScreen } from '../testing/render-screen';
import { DetailHero } from './DetailHero';
import { NavLinkProvider } from './NavLink';

/**
 * Stands in for iOS's zoom target (expo-router's Link.AppleZoomTarget), which takes exactly one
 * child and renders nothing at all when given more, counting an empty `null` slot as one.
 */
function strictZoomTarget(children: ReactNode) {
  return Children.count(children) === 1 ? <>{children}</> : <Text>zoom target refused</Text>;
}

const photo = { source: { uri: 'https://photos.test/walkman.jpg' }, label: 'Retro Walkman' };

it('gives the zoom target one child, so the photo shows on iOS', () => {
  renderScreen(
    <NavLinkProvider target={strictZoomTarget}>
      <DetailHero photos={[photo]} />
    </NavLinkProvider>,
  );
  expect(screen.queryByText('zoom target refused')).toBeNull();
  expect(screen.getByLabelText('Retro Walkman')).toBeOnTheScreen();
});

it('gives the zoom target one child when there is no photo too', () => {
  renderScreen(
    <NavLinkProvider target={strictZoomTarget}>
      <DetailHero label="Retro Walkman" />
    </NavLinkProvider>,
  );
  expect(screen.queryByText('zoom target refused')).toBeNull();
  expect(screen.getByLabelText('Retro Walkman, no photo')).toBeOnTheScreen();
});
