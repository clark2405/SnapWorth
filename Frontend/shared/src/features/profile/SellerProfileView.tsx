import { Flag, UserX } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  EmptyState,
  IconButton,
  NavHeader,
  Reveal,
  Screen,
  SWText,
} from '../../components';
import { tokens } from '../../design';
import { ListingCard } from '../marketplace/ListingCard';
import { previewListings, previewSellers } from '../preview/sample-data';

export interface SellerProfileViewProps {
  readonly handle?: string;
  readonly onBack?: () => void;
  readonly onOpenListing?: (listingId: string) => void;
  /** Report and block live here, as they do in chat (SRS 3.1.10). */
  readonly onReport?: () => void;
}

export function SellerProfileView({
  handle,
  onBack,
  onOpenListing,
  onReport,
}: SellerProfileViewProps) {
  const seller = handle ? previewSellers[handle] : undefined;

  if (!seller) {
    return (
      <Screen header={<NavHeader title="Seller" onBack={onBack} />}>
        <EmptyState
          icon={UserX}
          title="Seller not found"
          body="This account may have been removed or the link is out of date."
          actionLabel="Go back"
          onAction={onBack}
        />
      </Screen>
    );
  }

  const listings = previewListings.filter((listing) => seller.listingIds.includes(listing.id));

  return (
    <Screen
      header={
        <NavHeader
          title={`@${seller.user.handle}`}
          onBack={onBack}
          trailing={
            <IconButton icon={Flag} label="Report or block this seller" onPress={onReport} />
          }
        />
      }
      contentStyle={styles.content}
    >
      <Reveal index={0} style={styles.identity}>
        <Avatar source={seller.user.avatar} name={seller.user.handle} size={72} />
        <View style={styles.identityText}>
          <SWText variant="headingLarge" accessibilityRole="header">
            {seller.displayName}
          </SWText>
          <SWText variant="bodySmall" tone="textSecondary">
            ★ {seller.rating} · {seller.sales} sales
          </SWText>
          <SWText variant="caption" tone="textMuted">
            {seller.joined}
          </SWText>
        </View>
      </Reveal>

      <Reveal index={1}>
        <SWText variant="bodyMedium" tone="textSecondary">
          {seller.bio}
        </SWText>
      </Reveal>

      <Reveal index={2} style={styles.section}>
        <SWText variant="overline" tone="textMuted" accessibilityRole="header">
          {`Listings · ${listings.length}`}
        </SWText>
        {listings.length === 0 ? (
          <EmptyState
            icon={UserX}
            title="Nothing for sale right now"
            body="This seller has no active listings."
          />
        ) : (
          <View style={styles.grid}>
            {listings.map((listing) => (
              <View key={listing.id} style={styles.cell}>
                <ListingCard listing={listing} onPress={() => onOpenListing?.(listing.id)} />
              </View>
            ))}
          </View>
        )}
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: tokens.spacing[4],
    gap: tokens.spacing[6],
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[4],
  },
  identityText: {
    flex: 1,
    gap: tokens.spacing[1],
  },
  section: {
    gap: tokens.spacing[3],
    paddingTop: tokens.spacing[6],
    borderTopWidth: tokens.border.hairline,
    borderTopColor: tokens.color.dark.borderSubtle,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spacing[4],
    rowGap: tokens.spacing[6],
  },
  cell: {
    flexBasis: '46%',
    flexGrow: 1,
  },
});
