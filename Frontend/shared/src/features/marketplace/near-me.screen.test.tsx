import { MenuView } from '@expo/ui/community/menu';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { DeviceLocationPort, DeviceLocationResult } from '../../ports/location';
import { renderScreen } from '../../testing/render-screen';
import { Platform } from 'react-native';

import { MarketplaceView } from './MarketplaceView';
import { NearMeNotice, nearMeCopy } from './NearMeNotice';
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

  it('says so in the Location sheet itself, before it is closed', async () => {
    renderMarket({ status: 'denied' });
    await screen.findByText('Mechanical Keychron Keyboard');
    const menus = screen.UNSAFE_getAllByType(MenuView);
    act(() => {
      menus[menus.length - 1]!.props.onPressAction({ nativeEvent: { event: '__more__' } });
    });

    // Only the sheet is open: nothing has been applied, so the Market's own notice is not up.
    expect(await screen.findByText('Location is off for SnapWorth')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Clear Near me' })).toBeOnTheScreen();
    expect(screen.getAllByText('Location is off for SnapWorth')).toHaveLength(1);
  });
});

describe('the Near me notice, worded for where it runs', () => {
  it('talks about Settings and the phone on a phone', () => {
    const { title, body } = nearMeCopy('denied', 'ios');

    expect(title).toBe('Location is off for SnapWorth');
    expect(body).toMatch(/Settings/);
    expect(body).toMatch(/stays on your phone/);
  });

  it('talks about the browser and this site on the web', () => {
    const { title, body } = nearMeCopy('denied', 'web');

    expect(title).toBe('Location is blocked for this site');
    expect(body).toMatch(/browser/);
    expect(body).not.toMatch(/phone/);
  });

  it('shows the web wording and offers Try again, since a blocked site can be allowed again', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    renderScreen(<NearMeNotice status="denied" onTryAgain={jest.fn()} onClear={jest.fn()} />);

    expect(screen.getByText('Location is blocked for this site')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    jest.restoreAllMocks();
  });

  it('keeps Try again away on a phone, where only Settings can change the answer', () => {
    renderScreen(<NearMeNotice status="denied" onTryAgain={jest.fn()} onClear={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear Near me' })).toBeOnTheScreen();
  });

  it('offers Try again when the position just could not be found', () => {
    renderScreen(<NearMeNotice status="unavailable" onTryAgain={jest.fn()} onClear={jest.fn()} />);

    expect(screen.getByText('Couldn’t find where you are')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });
});
