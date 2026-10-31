import { MenuView } from '@expo/ui/community/menu';
import { StyleSheet } from 'react-native';

import { haptic, useTheme } from '../../design';
import type { FilterMenuProps } from './filter-menu';
import { FilterPillFace } from './MarketFilters';

export type { FilterChoice, FilterMenuProps } from './filter-menu';

/** The menu id of the choice that needs more than a tap. */
const moreId = '__more__';

/**
 * On iOS a Market filter opens the system's own menu, like the filter buttons in Apple's apps,
 * from the app's own pill: one tap lists the quick choices, ticked where chosen, and a choice
 * that needs more (a custom price range, a distance) opens a sheet with just that.
 */
export function FilterMenu({
  icon,
  placeholder,
  value,
  choices,
  chosenKey,
  onChoose,
  more,
}: FilterMenuProps) {
  const { isDark } = useTheme();
  return (
    <MenuView
      colorScheme={isDark ? 'dark' : 'light'}
      style={styles.menu}
      onOpenMenu={() => haptic('select')}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event === moreId) more?.onOpen();
        else if (nativeEvent.event !== chosenKey) onChoose(nativeEvent.event);
      }}
      actions={[
        {
          id: 'choices',
          title: '',
          displayInline: true,
          subactions: choices.map((choice) => ({
            id: choice.key,
            title: choice.label,
            state: choice.key === chosenKey ? 'on' : 'off',
          })),
        },
        ...(more ? [{ id: moreId, title: more.label, image: more.systemImage }] : []),
      ]}
    >
      <FilterPillFace icon={icon} placeholder={placeholder} value={value} />
    </MenuView>
  );
}

const styles = StyleSheet.create({
  // Room for the pill's 2pt hard shadow, which the menu would otherwise clip.
  menu: {
    paddingRight: 2,
    paddingBottom: 2,
  },
});
