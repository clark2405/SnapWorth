import {
  dailyItems,
  dayKey,
  guessAmount,
  guessPoints,
  guessPool,
  roundsPerDay,
  shareText,
  sharpEyes,
  streak,
  type DayGame,
} from './guess-game';

const finished = (day: string, points = 100): DayGame => ({
  day,
  guesses: Array.from({ length: roundsPerDay }, (_, index) => ({
    itemId: `item-${index}`,
    amount: 1000,
    points,
  })),
});

it('draws from every Market listing that has an AI estimate', () => {
  expect(guessPool()).toHaveLength(8);
});

it('carries no verdict for a listing nobody has voted on', () => {
  const [item] = guessPool(
    [
      {
        id: 'new',
        title: 'New',
        askingPrice: 1000,
        photo: 1,
        photoLabel: 'New',
        verdict: null,
        verdictShare: null,
      },
    ],
    { new: { estimate: 900, low: 800, high: 1000 } },
  );
  expect(item?.verdict).toBeNull();
  expect(item?.verdictShare).toBeNull();
});

it('deals five different things a day, the same ones all day', () => {
  const today = dailyItems('2026-11-04');
  expect(today).toHaveLength(roundsPerDay);
  expect(new Set(today.map((item) => item.id)).size).toBe(roundsPerDay);
  expect(dailyItems('2026-11-04').map((item) => item.id)).toEqual(today.map((item) => item.id));
});

it('deals something different on other days', () => {
  const days = ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].map((day) =>
    dailyItems(day)
      .map((item) => item.id)
      .join(),
  );
  expect(
    new Set([
      dailyItems('2026-11-04')
        .map((item) => item.id)
        .join(),
      ...days,
    ]).size,
  ).toBeGreaterThan(1);
});

it('names a day in the phone’s own time', () => {
  expect(dayKey(new Date(2026, 10, 4, 23, 59))).toBe('2026-11-04');
  expect(dayKey(new Date(2026, 0, 9))).toBe('2026-01-09');
});

it('reads an amount however it’s typed', () => {
  expect(guessAmount('2,500')).toBe(2500);
  expect(guessAmount('₱ 1 900')).toBe(1900);
  expect(guessAmount('')).toBe(0);
  expect(guessAmount('abc')).toBe(0);
  expect(guessAmount('-50')).toBe(0);
});

it('scores a guess by how close it is to the worth', () => {
  expect(guessPoints(2000, 2000)).toBe(100);
  // Within 5% is still spot on.
  expect(guessPoints(2090, 2000)).toBe(100);
  // A quarter off is half the points, either way.
  expect(guessPoints(2500, 2000)).toBe(50);
  expect(guessPoints(1500, 2000)).toBe(50);
  // Half the worth away or more earns nothing.
  expect(guessPoints(3000, 2000)).toBe(0);
  expect(guessPoints(50000, 2000)).toBe(0);
});

it('counts a streak of finished days, kept until today is over', () => {
  const games = [finished('2026-10-30'), finished('2026-10-31'), finished('2026-11-01')];
  // Today isn't played yet: the streak still stands from yesterday, across the month's end.
  expect(streak(games, '2026-11-02')).toBe(3);
  expect(streak([...games, finished('2026-11-02')], '2026-11-02')).toBe(4);
  // A missed day ends it.
  expect(streak(games, '2026-11-03')).toBe(0);
  // A half-played day doesn't count.
  const halfway: DayGame = { day: '2026-11-02', guesses: finished('x').guesses.slice(0, 2) };
  expect(streak([...games, halfway], '2026-11-02')).toBe(3);
});

it('counts the days that earned the Sharp eye badge', () => {
  expect(sharpEyes([finished('2026-11-01', 90), finished('2026-11-02', 40)])).toBe(1);
});

it('shares a score without giving the prices away', () => {
  const game: DayGame = {
    day: '2026-11-04',
    guesses: [100, 95, 70, 30, 0].map((points, index) => ({
      itemId: `item-${index}`,
      amount: 2450,
      points,
    })),
  };
  const text = shareText(game);
  expect(text).toBe('SnapWorth · Guess the worth 2026-11-04\n295/500 🟩🟩🟨🟥🟥');
  expect(text).not.toContain('2450');
  expect(text).not.toContain('₱');
});
