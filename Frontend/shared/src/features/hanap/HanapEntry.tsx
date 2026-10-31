import { ChevronRight, Megaphone } from 'lucide-react-native';
import { View } from 'react-native';

import { PressableScale, Surface, SWText, Tag } from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import { useHanap } from './hanap-state';
import { hanapMatches } from './HanapView';

/**
 * Market's way into Hanap: what it is, in a line, and how many listings match the viewer's own
 * open posts, so a match is seen without going looking.
 */
export function HanapEntry({ onOpen }: { readonly onOpen?: () => void }) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const { mine } = useHanap();
  const matches = new Set(
    mine
      .filter((post) => post.status === 'open')
      .flatMap((post) => hanapMatches(post).map((listing) => listing.id)),
  ).size;

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`Hanap. ${
        matches > 0
          ? `${matches} ${matches === 1 ? 'listing matches' : 'listings match'} what you’re looking for.`
          : 'Post what you’re looking for.'
      }`}
      onPress={onOpen}
    >
      <Surface padding={tokens.spacing[4]} contentStyle={styles.row}>
        <Megaphone size={22} strokeWidth={1.75} color={colors.textPrimary} />
        <View style={styles.text}>
          <SWText variant="label">Hanap</SWText>
          <SWText variant="caption" tone="textSecondary">
            Looking for something? Post it, and sellers will know.
          </SWText>
        </View>
        {matches > 0 ? (
          <Tag label={matches === 1 ? '1 match' : `${matches} matches`} tone="mint" />
        ) : null}
        <ChevronRight size={18} strokeWidth={1.75} color={colors.textMuted} />
      </Surface>
    </PressableScale>
  );
}

const stylesFor = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  text: {
    flex: 1,
    gap: 2,
  },
}));
