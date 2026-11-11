const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

// What the meetup sheet writes: "Today, 2:00 PM", "Tomorrow, 10:00 AM", "Saturday, 6:00 PM".
const pattern =
  /^(today|tomorrow|sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*,?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i;

/**
 * When a meetup starts, in the device's own time, from the words the proposer's sheet wrote and
 * the moment they wrote them: "Today" means the day it was proposed, "Tomorrow" the day after,
 * and a weekday the next one of those (a week on, when it's proposed on that very day). Null for
 * anything else, since a time that can't be read must not be guessed at.
 */
export function resolveMeetupStart(when: string, proposedAt: string | Date): Date | null {
  const match = pattern.exec(when.trim());
  const proposed = new Date(proposedAt);
  if (!match || Number.isNaN(proposed.getTime())) return null;

  const clock = Number(match[2]);
  const minute = Number(match[3] ?? 0);
  if (clock < 1 || clock > 12 || minute > 59) return null;
  const hour = (clock % 12) + (match[4]!.toLowerCase() === 'pm' ? 12 : 0);

  const day = match[1]!.toLowerCase();
  const daysAhead =
    day === 'today'
      ? 0
      : day === 'tomorrow'
        ? 1
        : ((weekdays.indexOf(day as (typeof weekdays)[number]) - proposed.getDay() + 6) % 7) + 1;

  return new Date(
    proposed.getFullYear(),
    proposed.getMonth(),
    proposed.getDate() + daysAhead,
    hour,
    minute,
  );
}
