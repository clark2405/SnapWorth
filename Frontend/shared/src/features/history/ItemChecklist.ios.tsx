import { Host, HStack, List, Spacer, Text } from '@expo/ui/swift-ui';
import {
  environment,
  foregroundStyle,
  listRowBackground,
  listStyle,
  scrollContentBackground,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';

import { haptic, useTheme } from '../../design';
import { formatPeso } from '../preview/peso';
import { checklistHeight, type ItemChecklistProps } from './checklist';

export type { ChecklistItem, ItemChecklistProps } from './checklist';

/** One row of the system list: about this tall, for sizing the list to its rows. */
const rowHeight = 46;

/** On iOS, the system's own list in its select mode, with the circles iOS ticks. */
export function ItemChecklist({ items, selected, onChange }: ItemChecklistProps) {
  const { isDark, colors } = useTheme();
  return (
    <Host
      colorScheme={isDark ? 'dark' : 'light'}
      style={[styles.host, { height: Math.min(checklistHeight, items.length * rowHeight + 24) }]}
    >
      <List
        selection={[...selected]}
        onSelectionChange={(ids) => {
          haptic('select');
          onChange(ids.map(String));
        }}
        // Plain, with its own grey hidden, so the list sits on the sheet's paper with no box.
        modifiers={[
          environment('editMode', 'active'),
          listStyle('plain'),
          scrollContentBackground('hidden'),
        ]}
      >
        {items.map((item) => (
          <HStack
            key={item.id}
            modifiers={[tag(item.id), listRowBackground(colors.surface as string)]}
          >
            <Text>{item.title}</Text>
            <Spacer />
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {formatPeso(item.worth)}
            </Text>
          </HStack>
        ))}
      </List>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    alignSelf: 'stretch',
  },
});
