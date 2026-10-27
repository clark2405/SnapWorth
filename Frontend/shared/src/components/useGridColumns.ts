import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { tokens } from '../design';

export interface GridColumns {
  /** How many columns fit; one until the grid has been measured. */
  readonly columns: number;
  /** Each cell's width, so every column is the same size whatever the row holds. */
  readonly cellWidth: number | undefined;
  /** Empty cells that finish the last row, so its cards keep their width instead of stretching. */
  readonly fillers: number;
  readonly onLayout: (event: LayoutChangeEvent) => void;
}

/**
 * Lays a list out in as many columns as its own width fits: one on a phone, more as a window
 * widens. It measures the space the grid is actually given, so it works wherever it's placed.
 */
export function useGridColumns(
  count: number,
  {
    minWidth = tokens.layout.cardMinimum,
    maxColumns = 3,
    gap = tokens.layout.gridGap,
  }: { readonly minWidth?: number; readonly maxColumns?: number; readonly gap?: number } = {},
): GridColumns {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((current) => (current === next ? current : next));
  }, []);

  const fit = Math.floor((width + gap) / (minWidth + gap));
  const columns = width > 0 ? Math.max(1, Math.min(maxColumns, fit)) : 1;
  const cellWidth = width > 0 ? (width - gap * (columns - 1)) / columns : undefined;
  const fillers = columns > 1 ? (columns - (count % columns)) % columns : 0;
  return { columns, cellWidth, fillers, onLayout };
}
