const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const months = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;
const title = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

// What the meetup sheet writes now: a date in full, "Sat, Nov 22, 2:30 PM".
const datePattern = new RegExp(
  `^(?:(?:${weekdays.join('|')})[a-z]*\\s*,?\\s*)?(${months.join('|')})[a-z]*\\.?\\s+(\\d{1,2})\\s*,?\\s*(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)$`,
  'i',
);
// What it wrote before: "Today, 2:00 PM", "Tomorrow, 10:00 AM", "Saturday, 6:00 PM".
const relativePattern =
  /^(today|tomorrow|sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*,?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i;

/** A 12-hour clock reading as the hour and minute of the day, or null when it isn't one. */
function clockOf(clockText: string, minuteText: string | undefined, half: string) {
  const clock = Number(clockText);
  const minute = Number(minuteText ?? 0);
  if (clock < 1 || clock > 12 || minute > 59) return null;
  return { hour: (clock % 12) + (half.toLowerCase() === 'pm' ? 12 : 0), minute };
}

/** "2:30 PM", "10:00 AM". */
export function formatClock(hour: number, minute: number): string {
  const clock = hour % 12 === 0 ? 12 : hour % 12;
  return `${clock}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

/**
 * How a meetup's time is written into the chat: the date in full, "Sat, Nov 22, 2:30 PM", so it
 * reads the same whenever it's read (unlike "Today"), and in English whatever the phone's
 * language, so both sides' apps can read it back.
 */
export function formatMeetupWhen(at: Date): string {
  const day = title(weekdays[at.getDay()]!);
  const month = title(months[at.getMonth()]!);
  return `${day}, ${month} ${at.getDate()}, ${formatClock(at.getHours(), at.getMinutes())}`;
}

/** A day the meetup sheet offers: its key (`YYYY-MM-DD`), its chip's label and its date. */
export interface MeetupDay {
  readonly key: string;
  readonly label: string;
  readonly date: Date;
}

/**
 * The days a meetup can be set for, from today: "Today", "Tomorrow", then "Sat 22", with the
 * month added when it isn't this one ("Mon, Dec 1").
 */
export function meetupDays(now: Date, count = 21): readonly MeetupDay[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + index);
    const weekday = title(weekdays[date.getDay()]!);
    const label =
      index === 0
        ? 'Today'
        : index === 1
          ? 'Tomorrow'
          : date.getMonth() === now.getMonth()
            ? `${weekday} ${date.getDate()}`
            : `${weekday}, ${title(months[date.getMonth()]!)} ${date.getDate()}`;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { key, label, date };
  });
}

/**
 * When a meetup starts, in the device's own time, from the words the proposer's sheet wrote and
 * the moment they wrote them. A full date ("Sat, Nov 22, 2:30 PM") is the next one on or after
 * the day it was proposed. Older words are relative to that day: "Today" is the day it was
 * proposed, "Tomorrow" the day after, and a weekday the next one of those (a week on, when it's
 * proposed on that very day). Null for anything else, since a time that can't be read must not
 * be guessed at.
 */
export function resolveMeetupStart(when: string, proposedAt: string | Date): Date | null {
  const proposed = new Date(proposedAt);
  if (Number.isNaN(proposed.getTime())) return null;
  const text = when.trim();

  const dated = datePattern.exec(text);
  if (dated) {
    const time = clockOf(dated[3]!, dated[4], dated[5]!);
    const month = months.indexOf(dated[1]!.toLowerCase().slice(0, 3) as (typeof months)[number]);
    const date = Number(dated[2]);
    if (!time || month < 0) return null;
    const startOfProposedDay = new Date(
      proposed.getFullYear(),
      proposed.getMonth(),
      proposed.getDate(),
    );
    for (const year of [proposed.getFullYear(), proposed.getFullYear() + 1]) {
      const start = new Date(year, month, date, time.hour, time.minute);
      // A date that doesn't exist (Feb 30) rolls into the next month: not a date at all.
      if (start.getMonth() !== month) return null;
      if (start >= startOfProposedDay) return start;
    }
    return null;
  }

  const match = relativePattern.exec(text);
  if (!match) return null;
  const time = clockOf(match[2]!, match[3], match[4]!);
  if (!time) return null;

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
    time.hour,
    time.minute,
  );
}
