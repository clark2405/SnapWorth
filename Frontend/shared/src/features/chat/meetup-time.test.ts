import { formatMeetupWhen, meetupDays, resolveMeetupStart } from './meetup-time';

// Wednesday 11 November 2026, 9:30 AM on the device's own clock.
const wednesday = new Date(2026, 10, 11, 9, 30);

describe('resolveMeetupStart', () => {
  it('reads Today and Tomorrow from the day it was proposed', () => {
    expect(resolveMeetupStart('Today, 2:00 PM', wednesday)).toEqual(new Date(2026, 10, 11, 14, 0));
    expect(resolveMeetupStart('Tomorrow, 10:00 AM', wednesday)).toEqual(
      new Date(2026, 10, 12, 10, 0),
    );
  });

  it('reads a weekday as the next one', () => {
    expect(resolveMeetupStart('Saturday, 6:00 PM', wednesday)).toEqual(
      new Date(2026, 10, 14, 18, 0),
    );
    expect(resolveMeetupStart('Tuesday, 10:00 AM', wednesday)).toEqual(
      new Date(2026, 10, 17, 10, 0),
    );
  });

  it('reads a weekday proposed on that weekday as a week on, since Today would have been used', () => {
    const saturday = new Date(2026, 10, 14, 9, 0);

    expect(resolveMeetupStart('Saturday, 2:00 PM', saturday)).toEqual(
      new Date(2026, 10, 21, 14, 0),
    );
  });

  it('keeps the day it was proposed, however late', () => {
    const lateNight = new Date(2026, 10, 11, 23, 50);

    expect(resolveMeetupStart('Tomorrow, 10:00 AM', lateNight)).toEqual(
      new Date(2026, 10, 12, 10, 0),
    );
  });

  it('crosses a month end', () => {
    const last = new Date(2026, 10, 30, 9, 0);

    expect(resolveMeetupStart('Tomorrow, 10:00 AM', last)).toEqual(new Date(2026, 11, 1, 10, 0));
  });

  it('gets noon and midnight right', () => {
    expect(resolveMeetupStart('Today, 12:00 PM', wednesday)).toEqual(new Date(2026, 10, 11, 12, 0));
    expect(resolveMeetupStart('Tomorrow, 12:30 AM', wednesday)).toEqual(
      new Date(2026, 10, 12, 0, 30),
    );
  });

  it('is forgiving about spacing, case and short forms', () => {
    expect(resolveMeetupStart(' today,2pm ', wednesday)).toEqual(new Date(2026, 10, 11, 14, 0));
    expect(resolveMeetupStart('SAT 6:00 pm', wednesday)).toEqual(new Date(2026, 10, 14, 18, 0));
  });

  it('accepts the time as an ISO string, as a message carries it', () => {
    expect(resolveMeetupStart('Today, 2:00 PM', wednesday.toISOString())).toEqual(
      new Date(2026, 10, 11, 14, 0),
    );
  });

  it('is null for a time it cannot read, rather than a guess', () => {
    expect(resolveMeetupStart('after lunch', wednesday)).toBeNull();
    expect(resolveMeetupStart('Today', wednesday)).toBeNull();
    expect(resolveMeetupStart('Today, 14:00', wednesday)).toBeNull();
    expect(resolveMeetupStart('Today, 0:30 AM', wednesday)).toBeNull();
    expect(resolveMeetupStart('Today, 13:00 PM', wednesday)).toBeNull();
    expect(resolveMeetupStart('Today, 2:75 PM', wednesday)).toBeNull();
    expect(resolveMeetupStart('Today, 2:00 PM', 'not a date')).toBeNull();
  });
});

describe('a meetup set for a date', () => {
  it('writes the date in full, in English', () => {
    expect(formatMeetupWhen(new Date(2026, 10, 22, 14, 30))).toBe('Sun, Nov 22, 2:30 PM');
    expect(formatMeetupWhen(new Date(2026, 11, 1, 0, 15))).toBe('Tue, Dec 1, 12:15 AM');
  });

  it('reads it back as that day and time', () => {
    expect(resolveMeetupStart('Sun, Nov 22, 2:30 PM', wednesday)).toEqual(
      new Date(2026, 10, 22, 14, 30),
    );
    // Proposed for later the same day.
    expect(resolveMeetupStart('Wed, Nov 11, 6:00 PM', wednesday)).toEqual(
      new Date(2026, 10, 11, 18, 0),
    );
  });

  it('reads a date early in the year, proposed in December, as next year', () => {
    const december = new Date(2026, 11, 28, 9, 0);
    expect(resolveMeetupStart('Sat, Jan 2, 10:00 AM', december)).toEqual(
      new Date(2027, 0, 2, 10, 0),
    );
  });

  it('refuses a date that does not exist', () => {
    expect(resolveMeetupStart('Feb 30, 10:00 AM', wednesday)).toBeNull();
    expect(resolveMeetupStart('Nov 22, 13:00 PM', wednesday)).toBeNull();
  });

  it('offers three weeks of days, naming today, tomorrow and a new month', () => {
    const days = meetupDays(new Date(2026, 10, 28, 9, 0));
    expect(days).toHaveLength(21);
    expect(days.slice(0, 4).map((day) => day.label)).toEqual([
      'Today',
      'Tomorrow',
      'Mon 30',
      'Tue, Dec 1',
    ]);
    expect(days[3]!.key).toBe('2026-12-01');
  });
});
