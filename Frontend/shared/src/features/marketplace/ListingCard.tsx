import { StyleSheet, View } from 'react-native';

import { Photo, PressableScale, SWText, Tag, type TagTone } from '../../components';
import { tokens } from '../../design';
import type { VoteChoice } from '../../types';
import { voteLabels } from '../feed/CommunityVerdict';
import { formatPeso, type PreviewListing } from '../preview/sample-data';

// Consistent with the feed: only "Too High" reads as a warning; the design's red "Too Low"
// badge was an inconsistency.
const verdictTone: Record<VoteChoice, TagTone> = {
  just_right: 'outline',
  too_high: 'danger',
  too_low: 'neutral',
};

export function ListingCard({
  listing,
  onPress,
}: {
  listing: PreviewListing;
  onPress: () => void;
}) {
  const verdict = `${listing.verdictShare}% ${voteLabels[listing.verdict]}`;

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${listing.title}, asking ${formatPeso(listing.askingPrice)}, community says ${verdict}`}
      onPress={onPress}
      style={styles.card}
    >
      <Photo
        source={listing.photo}
        label={listing.photoLabel}
        aspectRatio={4 / 5}
        radius={tokens.radius.large}
      />
      <View style={styles.cardBody}>
        <SWText variant="priceMedium">{formatPeso(listing.askingPrice)}</SWText>
        <SWText variant="bodyCompact" tone="textSecondary" numberOfLines={2}>
          {listing.title}
        </SWText>
        <Tag label={verdict} tone={verdictTone[listing.verdict]} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.spacing[3],
  },
  cardBody: {
    gap: tokens.spacing[1],
  },
});
