import { cluesFrom, confirmedBrand, photoProblem } from './photo-check';

const good = { brightness: 0.6, sharpness: 700, subject: 0.4, looked: true, text: [], codes: [] };
const impression = {
  item: 'mechanical keyboard',
  category: 'electronics',
  brand: 'Logitech',
  colours: ['black'],
  usablePhoto: true,
};

// Measured on the sample photos: real ones 0.17–0.80 bright and 450–1600 sharp.
it('passes real photos, however moody', () => {
  expect(photoProblem(good)).toBeNull();
  expect(photoProblem({ ...good, brightness: 0.17, sharpness: 454 })).toBeNull();
});

it('names the worst problem first', () => {
  expect(photoProblem({ ...good, brightness: 0.06, sharpness: 20 })).toBe('dark');
  expect(photoProblem({ ...good, sharpness: 3 })).toBe('blurry');
  expect(photoProblem({ ...good, subject: null })).toBe('no_item');
});

it('never calls a photo empty when Vision couldn’t look', () => {
  expect(photoProblem({ ...good, subject: null, looked: false })).toBeNull();
});

it('keeps a close-up of a label, which has no subject but has text', () => {
  expect(photoProblem({ ...good, subject: null, text: ['US 10'] })).toBeNull();
  expect(photoProblem({ ...good, subject: null, codes: ['0123456789'] })).toBeNull();
});

it('trusts the model’s brand only when it’s printed in the photo', () => {
  expect(confirmedBrand(impression, [])).toBeNull();
  expect(confirmedBrand(impression, ['LOGITECH G PRO'])).toBe('Logitech');
  expect(confirmedBrand({ ...impression, brand: '' }, ['LOGITECH'])).toBeNull();
});

it('sends the cloud what was printed and what it looks like, never the guessed brand', () => {
  expect(cluesFrom(null, null)).toBeUndefined();
  expect(cluesFrom(good, null)).toBeUndefined();
  expect(cluesFrom({ ...good, text: ['US 10'] }, null)).toEqual({ text: ['US 10'], codes: [] });
  expect(cluesFrom(good, impression)).toEqual({
    text: [],
    codes: [],
    looksLike: { item: 'mechanical keyboard', category: 'electronics', colours: ['black'] },
  });
  expect(cluesFrom(good, { ...impression, item: ' ' })).toBeUndefined();
});
