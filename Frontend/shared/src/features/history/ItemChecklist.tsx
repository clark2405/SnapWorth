import { Check } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { Divider, Photo, PressableScale, SWText } from '../../components';
import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import { formatPeso } from '../preview/peso';
import { checklistHeight, type ItemChecklistProps } from './checklist';

export type { ChecklistItem, ItemChecklistProps } from './checklist';

/**
 * Picks several of the owner's things, each with a tick. On iOS it's the system's own list in
 * its select mode (`ItemChecklist.ios.tsx`).
 */
export function ItemChecklist({ items, selected, onChange }: ItemChecklistProps) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const toggle = (id: string) => {
    haptic('select');
    onChange(selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id]);
  };

  return (
    <ScrollView style={styles.list} nestedScrollEnabled>
      {items.map((item, index) => {
        const on = selected.includes(item.id);
        return (
          <View key={item.id}>
            {index > 0 ? <Divider style={styles.divider} /> : null}
            <PressableScale
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${item.title}, ${formatPeso(item.worth)}`}
              onPress={() => toggle(item.id)}
              style={styles.row}
            >
              <Photo
                source={item.photo}
                label={item.photoLabel}
                radius={tokens.radius.small}
                style={styles.thumb}
              />
              <View style={styles.text}>
                <SWText variant="label" numberOfLines={1}>
                  {item.title}
                </SWText>
                <SWText variant="caption" tone="textSecondary">
                  {formatPeso(item.worth)} est.
                </SWText>
              </View>
              <View style={[styles.box, on ? styles.boxOn : null]}>
                {on ? <Check size={16} strokeWidth={2.5} color={colors.onInverse} /> : null}
              </View>
            </PressableScale>
          </View>
        );
      })}
    </ScrollView>
  );
}

const stylesFor = themedStyles((colors) => ({
  list: {
    maxHeight: checklistHeight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
  },
  thumb: {
    width: 44,
    height: 44,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: tokens.radius.full,
    borderWidth: 2,
    borderColor: colors.interactiveBoundary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: colors.inverse,
    borderColor: colors.inverse,
  },
  divider: {
    marginLeft: 44 + tokens.spacing[3],
  },
}));
