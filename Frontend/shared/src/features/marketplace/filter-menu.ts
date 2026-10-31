import type { LucideIcon } from 'lucide-react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

/** One of a filter's quick choices, e.g. "Under ₱2,000" or "Cebu City". */
export interface FilterChoice {
  readonly key: string;
  readonly label: string;
}

export interface FilterMenuProps {
  readonly icon: LucideIcon;
  /** The iOS symbol for the same thing, e.g. `creditcard`. */
  readonly systemImage: SFSymbol;
  /** What the filter is, e.g. "Price", shown while nothing is chosen. */
  readonly placeholder: string;
  /** The filter as it stands, e.g. "Under ₱2,000", or null for none. */
  readonly value: string | null;
  /** The quick choices; the first is "none" ("Any price", "Anywhere"). */
  readonly choices: readonly FilterChoice[];
  /** The chosen quick choice, if the filter is one of them. */
  readonly chosenKey: string | null;
  readonly onChoose: (key: string) => void;
  /** A choice that needs more than a tap ("Custom range…", "Near me…"): opens the sheet. */
  readonly more?: {
    readonly label: string;
    readonly systemImage: SFSymbol;
    readonly onOpen: () => void;
  };
  /** Without iOS's menus: opens the sheet that holds every choice. */
  readonly onOpenSheet: () => void;
  readonly onClear: () => void;
}
