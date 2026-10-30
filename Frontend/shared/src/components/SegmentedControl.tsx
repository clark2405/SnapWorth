import { GlidingSegments, type SegmentedControlProps } from './GlidingSegments';

export type { SegmentedControlProps } from './GlidingSegments';

/** Two to four segments, drawn as the app's own gliding pill. iOS uses its own control. */
export function SegmentedControl<Key extends string>(props: SegmentedControlProps<Key>) {
  return <GlidingSegments {...props} />;
}
