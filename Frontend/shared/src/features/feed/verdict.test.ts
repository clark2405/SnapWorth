import { verdictFor } from './verdict';

describe('verdictFor', () => {
  it('waits for enough votes before calling it', () => {
    expect(verdictFor({ too_high: 2, just_right: 10, too_low: 1 })).toBeNull();
  });

  it('names a clear majority', () => {
    expect(verdictFor({ too_high: 4, just_right: 30, too_low: 2 })?.label).toBe('Priced right');
    expect(verdictFor({ too_high: 35, just_right: 12, too_low: 2 })?.label).toBe('Too high');
    expect(verdictFor({ too_high: 1, just_right: 5, too_low: 20 })?.label).toBe('Steal');
  });

  it('leaves a split crowd without a sticker', () => {
    expect(verdictFor({ too_high: 15, just_right: 15, too_low: 10 })).toBeNull();
  });
});
