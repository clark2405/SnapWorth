import { suggestedOffers } from './offer-suggestions';

it('steps under a big price in fifties', () => {
  expect(suggestedOffers(6500, [0.88, 0.93, 0.97])).toEqual([5700, 6000, 6300]);
});

it('never offers a cheap item more than it costs, or the same amount twice', () => {
  // A ₱30 bottle: every fraction comes to ₱25, offered once.
  expect(suggestedOffers(30, [0.88, 0.93, 0.97])).toEqual([25]);
  expect(suggestedOffers(150, [0.9, 0.95, 1])).toEqual([135, 140, 150]);
});

it('offers nothing for an item with no price', () => {
  expect(suggestedOffers(0, [0.9, 1])).toEqual([]);
});
