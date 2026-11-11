import { MenuView } from '@expo/ui/community/menu';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { DeviceLocationPort, DeviceLocationResult } from '../../ports/location';
import { renderScreen } from '../../testing/render-screen';
import { MarketplaceView } from './MarketplaceView';
import { MarketplaceProvider } from './marketplace-state';
import { ViewerLocationProvider } from './viewer-location';
import { createLocalMarketplaceRepository } from '../../adapters/local/marketplace-repository';
import { buildPreviewMarketListings } from './marketplace-seed';

const memoryStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      map.set(key, value);
    },
  };
};

function renderMarket(result: DeviceLocationResult) {
  const port: DeviceLocationPort = { current: jest.fn(async () => result) };
  const repository = createLocalMarketplaceRepository({
    store: memoryStore(),
    viewer: { userId: 'usr_viewer' as never, handle: 'viewer' },
    seedListings: buildPreviewMarketListings(),
    seedSaved: [],
  });
  renderScreen(
    <MarketplaceProvider repository={repository}>
      <ViewerLocationProvider port={port}>
        <MarketplaceView />
      </ViewerLocationProvider>
    </MarketplaceProvider>,
  );
  return port;
}

async function pickNearMe() {
  // On iOS the Location pill is the system menu (Category, Price, Location): its "Near me…"
  // choice opens a sheet with the distance, and Show applies it.
  const menus = screen.UNSAFE_getAllByType(MenuView);
  act(() => {
    menus[menus.length - 1]!.props.onPressAction({ nativeEvent: { event: '__more__' } });
  });
  fireEvent.press(await screen.findByText('Show 8 items'));
}

describe('Near me', () => {
  it('does not ask for location until someone picks Near me', async () => {
    const port = renderMarket({ status: 'denied' });
    await screen.findByText('Vintage Polaroid Sun 600');
    expect(port.current).not.toHaveBeenCalled();
  });

  it('narrows by distance once the viewer’s position is known', async () => {
    // Standing in Cebu City: Metro Manila's Keychron is ~570 km away.
    const port = renderMarket({
      status: 'granted',
      position: { lat: 10.3157, lng: 123.8854 },
    });
    await screen.findByText('Mechanical Keychron Keyboard');
    await pickNearMe();
    await waitFor(() => expect(port.current).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('Mechanical Keychron Keyboard')).toBeNull());
    expect(screen.getByText('Vintage Polaroid Sun 600')).toBeOnTheScreen();
  });

  it('says so, and shows everything, when location permission is denied', async () => {
    renderMarket({ status: 'denied' });
    await screen.findByText('Mechanical Keychron Keyboard');
    await pickNearMe();
    await waitFor(() =>
      expect(screen.getByText('Location is off for SnapWorth')).toBeOnTheScreen(),
    );
    expect(screen.getByText('Mechanical Keychron Keyboard')).toBeOnTheScreen();
  });
});
