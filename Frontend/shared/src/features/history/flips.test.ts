import { flipOf, flipTotals, gainLabel, maximumPaid, multipleLabel, parsePaid } from './flips';

it('reads a price paid however it was typed', () => {
  expect(parsePaid('150')).toBe(150);
  expect(parsePaid('₱1,500')).toBe(1500);
  expect(parsePaid(' 1 500 ')).toBe(1500);
  expect(parsePaid('PHP 250')).toBe(250);
  expect(parsePaid('99.50')).toBe(100);
  // A gift or a lucky find cost nothing.
  expect(parsePaid('0')).toBe(0);
});

it('turns down what isn’t a price', () => {
  expect(parsePaid('')).toBeNull();
  expect(parsePaid('cheap')).toBeNull();
  expect(parsePaid('-50')).toBeNull();
  expect(parsePaid('1.2.3')).toBeNull();
  expect(parsePaid(String(maximumPaid + 1))).toBeNull();
});

it('says how the flip went', () => {
  expect(gainLabel(flipOf(150, 2450).gain)).toBe('+₱2,300');
  expect(gainLabel(flipOf(2000, 1700).gain)).toBe('−₱300');
  expect(gainLabel(0)).toBe('Even');
});

it('gives the multiple only when it’s worth bragging about', () => {
  expect(multipleLabel(flipOf(150, 2450))).toBe('16×');
  expect(multipleLabel(flipOf(1000, 2500))).toBe('2.5×');
  expect(multipleLabel(flipOf(1000, 1500))).toBeNull();
  expect(multipleLabel(flipOf(0, 500))).toBeNull();
});

it('adds up only the items with a price paid', () => {
  const items = [
    { id: 'jacket', worth: 2450 },
    { id: 'camera', worth: 3500 },
    { id: 'shoes', worth: 7500 },
  ];
  expect(flipTotals(items, {})).toBeNull();
  expect(flipTotals(items, { jacket: 150, shoes: 6200 })).toEqual({
    count: 2,
    paid: 6350,
    worth: 9950,
    gain: 3600,
  });
});
