import { describeLatest, formatListTime } from './chat-format';

describe('chat list times', () => {
  const now = new Date(2026, 9, 29, 15, 0);

  it('shows the time today, then Yesterday, then the weekday, then the date', () => {
    expect(formatListTime(new Date(2026, 9, 29, 9, 5).toISOString(), now)).toMatch(/9:05/);
    expect(formatListTime(new Date(2026, 9, 28, 22, 0).toISOString(), now)).toBe('Yesterday');
    expect(formatListTime(new Date(2026, 9, 25, 12, 0).toISOString(), now)).toBe('Sun');
    expect(formatListTime(new Date(2026, 8, 14, 12, 0).toISOString(), now)).toMatch(/Sep 14/);
  });
});

describe('the latest message in one line', () => {
  it('says what an offer or a pickup is', () => {
    expect(describeLatest({ fromMe: false, body: '', offerPhp: 2050 })).toMatch(/^Offered ₱2,050$/);
    expect(describeLatest({ fromMe: false, body: 'Ayala?', offerPhp: 2050 })).toMatch(
      /^Offered ₱2,050 · Ayala\?$/,
    );
    expect(describeLatest({ fromMe: true, body: '', meetupPlace: 'SM City Cebu' })).toBe(
      'Pickup at SM City Cebu',
    );
    expect(
      describeLatest({
        fromMe: false,
        body: '',
        meetupPlace: 'Plaza Independencia',
        meetupPurpose: 'viewing',
      }),
    ).toBe('Viewing at Plaza Independencia');
    expect(describeLatest({ fromMe: true, body: 'Hi!' })).toBe('Hi!');
    expect(describeLatest(undefined)).toBe('No messages yet');
  });
});
