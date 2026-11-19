import { useEffect, useMemo, useState } from 'react';

import { ChoiceChips, SWText } from '../../components';
import { formatClock, formatMeetupWhen, meetupDays } from './meetup-time';

export interface MeetupWhenPickerProps {
  /** The moment the sheet opened: nothing before it can be chosen. */
  readonly now: Date;
  readonly value: Date | null;
  readonly onChange: (at: Date | null) => void;
}

/**
 * When to meet, on Android and the web: a day from the next three weeks, then an hour and a
 * quarter hour, never a time already gone. (iOS has the system's wheel: `MeetupWhenPicker.ios`.)
 */
export function MeetupWhenPicker({ now, value, onChange }: MeetupWhenPickerProps) {
  const [day, setDay] = useState<string | null>(null);
  const [hour, setHour] = useState<string | null>(null);
  const [minute, setMinute] = useState('0');
  const when = useMeetupWhen(now, day, hour, minute);

  // A choice the day left behind (an hour already gone today) is no choice at all.
  useEffect(() => {
    if (hour !== null && !when.hours.some((option) => option.key === hour)) setHour(null);
    else if (!when.minutes.some((option) => option.key === minute))
      setMinute(when.minutes[0]?.key ?? '0');
  }, [hour, minute, when.hours, when.minutes]);

  const chosen = when.at?.getTime() ?? null;
  useEffect(() => {
    if ((value?.getTime() ?? null) !== chosen) onChange(chosen === null ? null : new Date(chosen));
  }, [chosen, onChange, value]);

  return (
    <>
      <ChoiceChips label="Day" options={when.days} value={day} scroll onChange={setDay} />
      {day !== null ? (
        <>
          <ChoiceChips label="Hour" options={when.hours} value={hour} scroll onChange={setHour} />
          <ChoiceChips label="Minute" options={when.minutes} value={minute} onChange={setMinute} />
        </>
      ) : null}
      {when.at ? (
        <SWText variant="bodySmall" tone="textSecondary" accessibilityLiveRegion="polite">
          {formatMeetupWhen(when.at)}
        </SWText>
      ) : null}
    </>
  );
}

const meetupHours = Array.from({ length: 17 }, (_, index) => index + 6); // 6 AM to 10 PM
const meetupMinutes = [0, 15, 30, 45];

/**
 * The days, hours and minutes a meetup can be set for, from the moment the sheet opened: any of
 * the next three weeks, 6 AM to 10 PM in quarter hours, never a time already gone today. `at` is
 * the time chosen, once there's a day and an hour.
 */
function useMeetupWhen(now: Date, day: string | null, hour: string | null, minute: string) {
  return useMemo(() => {
    const later = (at: Date) => at.getTime() > now.getTime();
    const days = meetupDays(now).filter((option) =>
      meetupHours.some((h) =>
        meetupMinutes.some((m) =>
          later(
            new Date(
              option.date.getFullYear(),
              option.date.getMonth(),
              option.date.getDate(),
              h,
              m,
            ),
          ),
        ),
      ),
    );
    const chosen = days.find((option) => option.key === day)?.date ?? null;
    const at = (h: number, m: number) =>
      chosen ? new Date(chosen.getFullYear(), chosen.getMonth(), chosen.getDate(), h, m) : null;
    const hours = meetupHours
      .filter((h) =>
        meetupMinutes.some((m) => {
          const t = at(h, m);
          return t !== null && later(t);
        }),
      )
      .map((h) => ({ key: String(h), label: formatClock(h, 0).replace(':00', '') }));
    const minutes = meetupMinutes
      .filter((m) => {
        const t = hour === null ? null : at(Number(hour), m);
        return t === null || later(t);
      })
      .map((m) => ({ key: String(m), label: `:${String(m).padStart(2, '0')}` }));
    const time = hour === null ? null : at(Number(hour), Number(minute));
    return {
      days: days.map(({ key, label }) => ({ key, label })),
      hours,
      minutes,
      at: time && later(time) ? time : null,
    };
  }, [day, hour, minute, now]);
}
