import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Field, Sheet, SWText, TextField } from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import type { ChecklistItem } from './checklist';
import { collectionName, maximumCollectionName } from './collections';
import { ItemChecklist } from './ItemChecklist';

/**
 * Names a collection: a new one, with its first items picked here too, or an existing one being
 * renamed (no `items`).
 */
export function CollectionNameSheet({
  visible,
  title,
  confirmLabel,
  initialName = '',
  items,
  initialSelected = [],
  onClose,
  onSave,
}: {
  readonly visible: boolean;
  readonly title: string;
  readonly confirmLabel: string;
  readonly initialName?: string;
  /** The owner's things to pick from; leave out to only ask for a name. */
  readonly items?: readonly ChecklistItem[];
  readonly initialSelected?: readonly string[];
  readonly onClose: () => void;
  readonly onSave: (name: string, selected: readonly string[]) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const [text, setText] = useState(initialName);
  const [selected, setSelected] = useState<readonly string[]>(initialSelected);

  useEffect(() => {
    if (!visible) return;
    setText(initialName);
    setSelected(initialSelected);
    // Only reset when the sheet opens, not while the owner is picking.
    // A new `initialSelected` array each render would otherwise undo every tick.
  }, [visible]);

  const name = collectionName(text);

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Field label="Name">
        <TextField
          value={text}
          onChangeText={setText}
          placeholder="e.g. Film cameras"
          maxLength={maximumCollectionName}
          accessibilityLabel="Collection name"
          autoFocus={!items}
        />
      </Field>
      {items ? (
        <View style={styles.pick}>
          <SWText variant="labelSmall" tone="textSecondary">
            {selected.length === 0 ? 'Pick what goes in it' : `${selected.length} picked`}
          </SWText>
          <ItemChecklist items={items} selected={selected} onChange={setSelected} />
        </View>
      ) : null}
      <Button
        label={confirmLabel}
        haptic="pop"
        disabled={name === null}
        onPress={() => name && onSave(name, selected)}
      />
    </Sheet>
  );
}

/** Changes which of the owner's things are in a collection. */
export function CollectionItemsSheet({
  visible,
  items,
  selected: initialSelected,
  onClose,
  onSave,
}: {
  readonly visible: boolean;
  readonly items: readonly ChecklistItem[];
  readonly selected: readonly string[];
  readonly onClose: () => void;
  readonly onSave: (selected: readonly string[]) => void;
}) {
  const [selected, setSelected] = useState<readonly string[]>(initialSelected);

  useEffect(() => {
    if (visible) setSelected(initialSelected);
    // Only reset when the sheet opens, not while the owner is picking.
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose} title="What’s in it">
      <ItemChecklist items={items} selected={selected} onChange={setSelected} />
      <Button label="Done" haptic="pop" onPress={() => onSave(selected)} />
    </Sheet>
  );
}

const stylesFor = themedStyles(() => ({
  pick: {
    gap: tokens.spacing[2],
  },
}));
