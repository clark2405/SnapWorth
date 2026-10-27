import { tokens } from './tokens';

/**
 * How much room the app has to lay itself out in. Only the web changes shape: the native apps
 * are phone apps at every size. `compact` is the phone layout (bottom tab bar, one column),
 * `medium` adds a navigation rail and wider content, and `expanded` a labelled sidebar and
 * multi-column grids.
 */
export type LayoutClass = 'compact' | 'medium' | 'expanded';

export function layoutClassFor(width: number, platform: string): LayoutClass {
  if (platform !== 'web') return 'compact';
  if (width >= tokens.breakpoint.expanded) return 'expanded';
  if (width >= tokens.breakpoint.medium) return 'medium';
  return 'compact';
}

/** How many columns a grid of cards fits in `width`, from one up to `max`. */
export function gridColumnsFor(width: number, max = 3): number {
  const { cardMinimum, gridGap } = tokens.layout;
  const fit = Math.floor((width + gridGap) / (cardMinimum + gridGap));
  return Math.max(1, Math.min(max, fit));
}
