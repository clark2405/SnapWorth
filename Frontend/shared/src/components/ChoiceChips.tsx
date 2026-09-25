import { ScrollView, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { haptic, themedStyles, tokens, useThemedStyles } from '../design';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

export interface ChoiceChipsProps<Key extends string> {
  readonly options: readonly {
    readonly key: Key;
    readonly label: string;
    readonly hint?: string;
  }[];
  readonly value: Key | null;
  readonly onChange: (key: Key) => void;
  /** Scroll sideways instead of wrapping, for long category lists. */
  readonly scroll?: boolean;
}

/**
 * A row of pill choices. The selected pill inverts to the monochrome fill; layout changes
 * (a hint appearing under a choice) glide rather than jump.
 */
export function ChoiceChips<Key extends string>({
  options,
  value,
  onChange,
  scroll = false,
}: ChoiceChipsProps<Key>) {
  const styles = useThemedStyles(stylesFor);
  const chips = options.map((option) => {
    const active = option.key === value;
    return (
      <Animated.View key={option.key} layout={LinearTransition.springify().damping(20)}>
        <PressableScale
          accessibilityRole="radio"
          accessibilityState={{ selected: active }}
          accessibilityLabel={option.label}
          haptic="none"
          onPress={() => {
            if (!active) haptic('select');
            onChange(option.key);
          }}
          style={({ pressed }) => [
            styles.chip,
            active ? styles.active : null,
            pressed && !active ? styles.pressed : null,
          ]}
        >
          <SWText variant="labelSmall" tone={active ? 'onInverse' : 'textPrimary'}>
            {option.label}
          </SWText>
        </PressableScale>
      </Animated.View>
    );
  });

  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollRow}
        style={styles.bleed}
        accessibilityRole="radiogroup"
      >
        {chips}
      </ScrollView>
    );
  }
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {chips}
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
  },
  bleed: {
    marginHorizontal: -tokens.layout.pageGutterCompact,
    flexGrow: 0,
  },
  scrollRow: {
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.layout.pageGutterCompact,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  active: {
    backgroundColor: colors.inverse,
  },
  pressed: {
    backgroundColor: colors.borderSubtle,
  },
}));
