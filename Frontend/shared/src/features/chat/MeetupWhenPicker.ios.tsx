import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, labelsHidden } from '@expo/ui/swift-ui/modifiers';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, PressableScale, Sheet, SWText } from '../../components';
import { haptic, tokens, useTheme } from '../../design';
import { formatMeetupWhen } from './meetup-time';
import type { MeetupWhenPickerProps } from './MeetupWhenPicker';

export type { MeetupWhenPickerProps } from './MeetupWhenPicker';

/** How far ahead a meetup can be set: three weeks. */
const aheadDays = 21;

/**
 * The first time offered: the next full hour at least half an hour away, so there's time to get
 * there (1:23 PM offers 2:00 PM; 1:40 PM offers 3:00 PM).
 */
export function firstMeetupTime(now: Date): Date {
  const at = new Date(now.getTime() + 30 * 60_000);
  at.setMinutes(0, 0, 0);
  at.setHours(at.getHours() + 1);
  return at;
}

/**
 * When to meet, on iOS: a row with the time chosen, which opens the system's own date-and-time
 * wheel in a sheet of its own (inline, the wheel made the meetup sheet taller than the screen).
 * It starts on the next sensible hour, so a time is always chosen, and turning the wheel changes
 * it: any time from now to three weeks ahead.
 */
export function MeetupWhenPicker({ now, value, onChange }: MeetupWhenPickerProps) {
  const { colors, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const range = useMemo(
    () => ({
      start: now,
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + aheadDays, 22, 0),
    }),
    [now],
  );
  const selection = value ?? firstMeetupTime(now);

  // The wheel always shows a time, so that time is the choice until it's turned.
  useEffect(() => {
    if (value === null) onChange(firstMeetupTime(now));
  }, [now, onChange, value]);

  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Day and time, ${formatMeetupWhen(selection)}`}
        accessibilityHint="Opens a wheel to choose when to meet"
        haptic="select"
        onPress={() => setOpen(true)}
        style={styles.row}
      >
        <SWText variant="bodyMedium" tone="textSecondary">
          Day and time
        </SWText>
        <View style={styles.value}>
          <SWText variant="label" style={{ color: colors.accent }}>
            {formatMeetupWhen(selection)}
          </SWText>
          <ChevronRight size={16} strokeWidth={2} color={colors.accent} />
        </View>
      </PressableScale>
      <Sheet visible={open} onClose={() => setOpen(false)} title="When to meet">
        <Host
          matchContents={{ vertical: true }}
          colorScheme={isDark ? 'dark' : 'light'}
          style={styles.wheel}
        >
          <DatePicker
            title="When to meet"
            selection={selection}
            range={range}
            displayedComponents={['date', 'hourAndMinute']}
            onDateChange={(next) => {
              haptic('select');
              onChange(next);
            }}
            modifiers={[datePickerStyle('wheel'), labelsHidden()]}
          />
        </Host>
        <Button label="Done" onPress={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[1],
  },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
  },
  wheel: {
    width: '100%',
  },
});
