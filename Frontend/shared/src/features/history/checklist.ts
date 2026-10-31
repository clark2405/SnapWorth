import type { ImageSourcePropType } from 'react-native';

export interface ChecklistItem {
  readonly id: string;
  readonly title: string;
  readonly worth: number;
  readonly photo: ImageSourcePropType;
  readonly photoLabel: string;
}

export interface ItemChecklistProps {
  readonly items: readonly ChecklistItem[];
  readonly selected: readonly string[];
  readonly onChange: (selected: readonly string[]) => void;
}

/** The tallest the list grows before it scrolls, so a sheet's buttons stay in reach. */
export const checklistHeight = 360;
