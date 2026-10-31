import { fireEvent, screen } from '@testing-library/react-native';

import { createLocalSukiRepository } from '../../adapters';
import { renderScreen } from '../../testing/render-screen';
import { OfferSheet, SukiSheet } from './ChatSheets';
import { sukiPrice } from './suki';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => Promise.resolve(data.get(key) ?? null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

it('takes the discount off the asking price, to the nearest ten pesos', () => {
  expect(sukiPrice(2200, 10)).toBe(1980);
  expect(sukiPrice(1999, 15)).toBe(1700);
});

it('keeps a seller’s discount for a buyer, and the one a buyer gets', async () => {
  const suki = createLocalSukiRepository({ store: memoryStore(), seed: { 'buyer:sela': 5 } });
  await suki.set('bea', 10);
  expect(await suki.discountWith('bea', true)).toEqual({ ok: true, value: 10 });
  expect(await suki.discountWith('sela', false)).toEqual({ ok: true, value: 5 });
  await suki.set('bea', null);
  expect(await suki.discountWith('bea', true)).toEqual({ ok: true, value: null });
});

it('lets a seller make a buyer their suki', () => {
  const onSave = jest.fn();
  renderScreen(
    <SukiSheet visible handle="bea" discountPct={null} onClose={() => undefined} onSave={onSave} />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Make them my suki' }));

  expect(onSave).toHaveBeenCalledWith(10);
});

it('starts a suki’s offer from their suki price', () => {
  renderScreen(
    <OfferSheet
      visible
      askingPrice={2200}
      countering={false}
      sukiPct={10}
      onClose={() => undefined}
      onSend={() => undefined}
    />,
  );

  expect(screen.getByText('Your suki price is ₱1,980, 10% off ₱2,200.')).toBeOnTheScreen();
  // The suki price is the first quick amount.
  expect(screen.getAllByRole('radio')[0]).toHaveAccessibleName('₱1,980');
});
