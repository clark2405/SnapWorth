import type { FilterMenuProps } from './filter-menu';
import { FilterPill } from './MarketFilters';

export type { FilterChoice, FilterMenuProps } from './filter-menu';

/**
 * A Market filter. Here it's the app's own pill, opening a sheet with every choice; on iOS it's
 * the system's own menu (`FilterMenu.ios.tsx`).
 */
export function FilterMenu({ icon, placeholder, value, onOpenSheet, onClear }: FilterMenuProps) {
  return (
    <FilterPill
      icon={icon}
      placeholder={placeholder}
      value={value}
      onOpen={onOpenSheet}
      onClear={onClear}
    />
  );
}
