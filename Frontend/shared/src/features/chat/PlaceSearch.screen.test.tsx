import { act, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderScreen } from '../../testing/render-screen';
import { PlaceSearch } from './PlaceSearch';
import { searchPauseMs } from './place-search';

const photon = {
  features: [
    {
      geometry: { coordinates: [123.8940889, 10.3095785] },
      properties: {
        name: 'Jollibee',
        street: 'General Maxilom Avenue',
        city: 'Cebu City',
        countrycode: 'PH',
      },
    },
  ],
};

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(photon) }),
  ) as unknown as typeof fetch;
});
afterEach(() => jest.useRealTimers());

it('looks places up after a pause in typing, over the map, and picks one', async () => {
  const onPick = jest.fn();
  renderScreen(
    <PlaceSearch onPick={onPick} near={{ lat: 10.31, lng: 123.89 }}>
      <Text>The map</Text>
    </PlaceSearch>,
  );
  const field = screen.getByLabelText('Search for a place to meet');

  fireEvent.changeText(field, 'jol');
  fireEvent.changeText(field, 'jolli');
  // Nothing is asked while the person is still typing.
  expect(global.fetch).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(searchPauseMs);
  });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const url = String((global.fetch as jest.Mock).mock.calls[0][0]);
  expect(url).toContain('q=jolli');
  expect(url).toContain('lat=10.3100');

  // The places drop down over the map; the map is still there beneath them.
  const place = await screen.findByRole('button', {
    name: 'Jollibee, General Maxilom Avenue, Cebu City. Move the map here',
  });
  expect(screen.getByText('The map')).toBeTruthy();

  fireEvent.press(place);
  expect(onPick).toHaveBeenCalledWith({
    name: 'Jollibee',
    detail: 'General Maxilom Avenue, Cebu City',
    lat: 10.3095785,
    lng: 123.8940889,
  });
});

it('matches the suggested spots at once, before any lookup', () => {
  renderScreen(
    <PlaceSearch onPick={() => undefined}>
      <Text>The map</Text>
    </PlaceSearch>,
  );
  fireEvent.changeText(screen.getByLabelText('Search for a place to meet'), 'ayala');

  expect(screen.getByText('Ayala Center Cebu')).toBeTruthy();
  expect(global.fetch).not.toHaveBeenCalled();
});
