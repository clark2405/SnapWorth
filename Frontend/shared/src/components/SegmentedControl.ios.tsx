import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';

import { haptic, useTheme } from '../design';
import type { SegmentedControlProps } from './GlidingSegments';

export type { SegmentedControlProps } from './GlidingSegments';

/** On iOS, the system's own segmented control. */
export function SegmentedControl<Key extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<Key>) {
  const { isDark } = useTheme();
  return (
    <Host
      matchContents={{ vertical: true }}
      colorScheme={isDark ? 'dark' : 'light'}
      style={styles.host}
    >
      <Picker
        selection={value}
        onSelectionChange={(key: string) => {
          if (key === value) return;
          haptic('select');
          onChange(key as Key);
        }}
        modifiers={[pickerStyle('segmented')]}
      >
        {options.map((option) => (
          <Text key={option.key} modifiers={[tag(option.key)]}>
            {option.label}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    alignSelf: 'stretch',
  },
});
