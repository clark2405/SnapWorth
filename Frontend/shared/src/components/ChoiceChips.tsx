import { ChipRow, type ChoiceChipsProps } from './ChipRow';

export type { ChoiceChipsProps } from './ChipRow';

/** A row of choices, drawn as the app's own chips (see `ChipRow`). iOS uses its own picker. */
export function ChoiceChips<Key extends string>(props: ChoiceChipsProps<Key>) {
  return <ChipRow {...props} />;
}
