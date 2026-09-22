import { StyleSheet, View } from 'react-native';

import { tokens } from '../design';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

export interface SegmentedControlProps<Key extends string> {
  readonly options: readonly { readonly key: Key; readonly label: string }[];
  readonly value: Key;
  readonly onChange: (key: Key) => void;
}

export function SegmentedControl<Key extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<Key>) {
  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <PressableScale
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.key)}
            containerStyle={styles.slot}
            style={[styles.segment, active ? styles.active : null]}
          >
            <SWText variant="label" tone={active ? 'textPrimary' : 'textMuted'}>
              {option.label}
            </SWText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: tokens.spacing[1],
    borderRadius: tokens.radius.medium,
    backgroundColor: tokens.glass.fill,
  },
  slot: {
    flex: 1,
  },
  segment: {
    minHeight: 36,
    borderRadius: tokens.radius.medium - tokens.spacing[1],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: tokens.border.hairline,
    borderColor: 'transparent',
  },
  active: {
    backgroundColor: tokens.glass.fillPressed,
    borderColor: tokens.glass.border,
  },
});
