import { askingLine } from './asking-line';

const peso = (amount: number) => `₱${amount.toLocaleString('en-US')}`;
const range = { estimate: 3000, low: 2600, high: 3400 };

describe('askingLine', () => {
  it('tells a buyer when a steal will not last', () => {
    expect(askingLine({ ...range, asking: 2000 }, false, peso)).toMatch(/under its worth/);
  });

  it('suggests an offer on a fair ask', () => {
    expect(askingLine({ ...range, asking: 2900 }, false, peso)).toMatch(/Offer ₱2,750/);
  });

  it('points out an ask over the range', () => {
    expect(askingLine({ ...range, asking: 4000 }, false, peso)).toMatch(/₱1,000 over its worth/);
  });

  it('tells the seller whether the price will sell', () => {
    expect(askingLine({ ...range, asking: 4000 }, true, peso)).toMatch(
      /usually sells within a week/,
    );
    expect(askingLine({ ...range, asking: 3000 }, true, peso)).toMatch(/Priced to sell/);
  });
});
