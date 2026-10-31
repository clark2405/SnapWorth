import {
  Easing,
  LinearTransition,
  withDelay,
  withTiming,
  type EntryAnimationsValues,
  type ExitAnimationsValues,
  type LayoutAnimation,
} from 'react-native-reanimated';

/**
 * How things move on SnapWorth's paper. Cards, rows, messages and tags are cut paper, so they
 * move like it: laid down on the page, never bounced onto it. Every curve here is the app's
 * expo-out (`tokens.motion.easing.enter`): quick to start, long and soft to settle, no
 * overshoot. With reduced motion, Reanimated makes each of these instant.
 */
const settle = Easing.bezier(0.16, 1, 0.3, 1);
const lift = Easing.bezier(0.4, 0, 1, 1);

/** How long a piece takes to be laid down, and to lift away. */
const settleMs = 360;
const liftMs = 160;

/**
 * A piece of paper laid down on the page: it rises a few points, firms up from 97% and fades
 * in, all on one soft curve. `delay` staggers a list; `rise` is how far it comes up from.
 */
export function paperIn(delay = 0, rise = 10) {
  return (_values: EntryAnimationsValues): LayoutAnimation => {
    'worklet';
    const timing = { duration: settleMs, easing: settle };
    return {
      initialValues: { opacity: 0, transform: [{ translateY: rise }, { scale: 0.97 }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, { duration: settleMs * 0.6, easing: settle })),
        transform: [
          { translateY: withDelay(delay, withTiming(0, timing)) },
          { scale: withDelay(delay, withTiming(1, timing)) },
        ],
      },
    };
  };
}

/** A piece lifted off the page: it shrinks a touch and fades, quickly, out of the way. */
export function paperOut(_values: ExitAnimationsValues): LayoutAnimation {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: liftMs, easing: lift }),
      transform: [{ scale: withTiming(0.97, { duration: liftMs, easing: lift }) }],
    },
  };
}

/**
 * A stamp pressed onto the page: it lands from a little larger, firmly, without bouncing. For
 * the one mark that heads a screen (an empty state's icon, a done tick).
 */
export function stampIn(_values: EntryAnimationsValues): LayoutAnimation {
  'worklet';
  const timing = { duration: 280, easing: settle };
  return {
    initialValues: { opacity: 0, transform: [{ scale: 1.12 }] },
    animations: {
      opacity: withTiming(1, { duration: 160, easing: settle }),
      transform: [{ scale: withTiming(1, timing) }],
    },
  };
}

/** Everything else on the page slides to its new place on the same soft curve. */
export const paperLayout = LinearTransition.duration(settleMs).easing(settle);
