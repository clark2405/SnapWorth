import { Host, HStack, Picker, Text } from '@expo/ui/swift-ui';
import { fixedSize, foregroundStyle, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';

import { haptic, useTheme } from '../design';
import { ChipRow, type ChoiceChipsProps } from './ChipRow';

export type { ChoiceChipsProps } from './ChipRow';

/** Up to this many short options sit side by side in a segmented control; more get a menu. */
const segmentLimit = { options: 5, label: 12, total: 36 };

/** The tag of the menu's "Choose" line, shown while nothing is chosen yet. */
const unchosen = '';

function fitsSegments(options: readonly { readonly label: string }[]) {
  const total = options.reduce((sum, option) => sum + option.label.length, 0);
  return (
    options.length <= segmentLimit.options &&
    total <= segmentLimit.total &&
    options.every((option) => option.label.length <= segmentLimit.label)
  );
}

/**
 * On iOS a choice is the system's own picker: a segmented control when the options are few and
 * short, a menu when they aren't. Action chips (quick replies, suggestions) stay chips, since
 * they do something rather than pick something.
 */
export function ChoiceChips<Key extends string>(props: ChoiceChipsProps<Key>) {
  const { isDark } = useTheme();
  const { options, value, onChange, kind = 'choice', label } = props;
  if (kind === 'action') return <ChipRow {...props} />;

  const segmented = fitsSegments(options);
  const choose = (key: string) => {
    if (key === unchosen || key === value) return;
    haptic('select');
    onChange(key as Key);
  };

  return (
    <Host
      matchContents={segmented ? { vertical: true } : true}
      colorScheme={isDark ? 'dark' : 'light'}
      style={segmented ? styles.segmented : styles.menu}
    >
      {/* A menu keeps its words on one line, however tight the row it sits in. */}
      <HStack spacing={4} modifiers={segmented ? [] : [fixedSize()]}>
        {!segmented && label ? (
          <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
            {label}
          </Text>
        ) : null}
        <Picker
          selection={value ?? unchosen}
          onSelectionChange={(key: string) => choose(key)}
          modifiers={[pickerStyle(segmented ? 'segmented' : 'menu')]}
        >
          {!segmented && value === null ? <Text modifiers={[tag(unchosen)]}>Choose</Text> : null}
          {options.map((option) => (
            <Text key={option.key} modifiers={[tag(option.key)]}>
              {option.label}
            </Text>
          ))}
        </Picker>
      </HStack>
    </Host>
  );
}

const styles = StyleSheet.create({
  segmented: {
    alignSelf: 'stretch',
  },
  menu: {
    alignSelf: 'flex-start',
  },
});
