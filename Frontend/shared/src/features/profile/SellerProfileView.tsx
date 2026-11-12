import { Flag, UserX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  paperIn,
  paperLayout,
  Avatar,
  EmptyState,
  IconButton,
  NavHeader,
  Rating,
  Reveal,
  Screen,
  ScreenSkeleton,
  SWText,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import type { SellerProfile } from '../../ports/marketplace';
import { ListingCard } from '../marketplace/ListingCard';
import {
  sellerAvatarSource,
  toPreviewListing,
  useMarketplace,
} from '../marketplace/marketplace-state';
import { useAccountGate } from '../session';

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
  const styles = useThemedStyles(stylesFor);
  const requireAccount = useAccountGate();
  const { loadSeller } = useMarketplace();
  const normalized = handle?.trim().toLowerCase().replace(/^@/, '');

  // `undefined` while the seller is being looked up; `null` once they're known not to exist.
  const [seller, setSeller] = useState<SellerProfile | null | undefined>(undefined);

  useEffect(() => {
    if (!normalized) {
      setSeller(null);
      return;
    }
    let active = true;
    void loadSeller(normalized).then((loaded) => {
      if (active) setSeller(loaded);
    });
    return () => {
      active = false;
    };
  }, [loadSeller, normalized]);

  if (seller === undefined) return <ScreenSkeleton kind="page" />;
  if (!seller) {
    return (
      <Screen ambient="market" header={<NavHeader title="Seller" onBack={onBack} />}>
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

  const listings = seller.listings.map(toPreviewListing);
  const avatar = sellerAvatarSource(seller);

  return (
    <Screen
      ambient="market"
      header={
        <NavHeader
          title={`@${seller.handle}`}
          onBack={onBack}
          trailing={
            <IconButton
              icon={Flag}
              label="Report or block this seller"
              onPress={() => requireAccount('report', onReport)}
            />
          }
        />
      }
      contentStyle={styles.content}
    >
      <Reveal index={0} style={styles.identity}>
        <Avatar source={avatar} name={seller.handle} size={72} ring />
        <View style={styles.identityText}>
          <SWText variant="displayMedium" accessibilityRole="header">
            {seller.displayName}
          </SWText>
          {seller.rating === null ? (
            <SWText variant="bodySmall" tone="textSecondary">
              {seller.sales === 1 ? '1 sale' : `${seller.sales} sales`}
            </SWText>
          ) : (
            <Rating
              value={seller.rating}
              detail={`${seller.sales} sales`}
              variant="bodySmall"
              tone="textSecondary"
            />
          )}
          <SWText variant="caption" tone="textMuted">
            {seller.joined}
          </SWText>
        </View>
      </Reveal>

      {seller.bio.length > 0 ? (
        <Reveal index={1}>
          <SWText variant="bodyMedium" tone="textSecondary">
            {seller.bio}
          </SWText>
        </Reveal>
      ) : null}

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
            {listings.map((listing, index) => (
              <Animated.View
                key={listing.id}
                entering={paperIn(Math.min(index, 4) * 50)}
                layout={paperLayout}
                style={styles.cell}
              >
                <ListingCard listing={listing} onOpen={() => onOpenListing?.(listing.id)} />
              </Animated.View>
            ))}
          </View>
        )}
      </Reveal>
    </Screen>
  );
}

const stylesFor = themedStyles((colors) => ({
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
    borderTopColor: colors.borderSubtle,
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
}));
