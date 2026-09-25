import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { SWText, type SWTextProps } from './SWText';

export interface CountUpProps extends Omit<SWTextProps, 'children'> {
  readonly value: number;
  readonly format: (value: number) => string;
  /** Where the count starts; defaults to a fraction of the value so it lands, not races. */
  readonly from?: number;
  readonly durationMs?: number;
  readonly delayMs?: number;
}

/**
 * A number that counts into place with a long decelerating tail, so the final digits settle
 * rather than tick. Screen readers get the final value immediately; reduced motion skips it.
 */
export function CountUp({
  value,
  format,
  from,
  durationMs = 900,
  delayMs = 0,
  ...text
}: CountUpProps) {
  const reduceMotion = useReducedMotion();
  const start = from ?? Math.round(value * 0.62);
  const [shown, setShown] = useState(reduceMotion ? value : start);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reduceMotion) {
      setShown(value);
      return;
    }
    let began: number | null = null;
    const origin = start;
    const tick = (now: number) => {
      if (began === null) began = now + delayMs;
      const t = Math.min(1, Math.max(0, (now - began) / durationMs));
      // expo-out: decisive start, long settle.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setShown(Math.round(origin + (value - origin) * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [delayMs, durationMs, reduceMotion, start, value]);

  return (
    <SWText accessibilityLabel={format(value)} {...text}>
      {format(shown)}
    </SWText>
  );
}
