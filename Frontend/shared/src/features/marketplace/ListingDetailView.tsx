import { ChevronRight, MessageSquare } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AskingPriceBadge,
  Avatar,
  BottomBar,
  Button,
  LikeButton,
  NavHeader,
  Photo,
  PressableScale,
  Reveal,
  Screen,
  Surface,
  SWText,
  Tag,
} from '../../components';
import { tokens } from '../../design';
import { formatPeso, previewListingDetail } from '../preview/sample-data';

export interface ListingDetailViewProps {
  readonly listingId?: string;
  readonly onBack?: () => void;
  readonly onMessageSeller?: () => void;
  readonly onOpenSeller?: () => void;
}

export function ListingDetailView({
  onBack,
  onMessageSeller,
  onOpenSeller,
}: ListingDetailViewProps) {
  const listing = previewListingDetail;
  const [saved, setSaved] = useState(false);
  const toggleSaved = () => setSaved((value) => !value);

  return (
    <Screen
      header={
        <NavHeader
          title="Listing"
          onBack={onBack}
          banded
          trailing={<LikeButton liked={saved} onToggle={toggleSaved} likeLabel="Save listing" />}
        />
      }
      footer={
        <BottomBar>
          <View style={styles.footerRow}>
            <LikeButton
              liked={saved}
              onToggle={toggleSaved}
              likeLabel="Save listing"
              appearance="outline"
              size={20}
            />
            <Button
              label="Message seller"
              icon={MessageSquare}
              onPress={onMessageSeller}
              containerStyle={styles.message}
            />
          </View>
        </BottomBar>
      }
      contentStyle={styles.content}
    >
      <Reveal index={0} style={styles.hero}>
        <Photo source={listing.photo} label={listing.photoLabel} aspectRatio={4 / 3} radius={0} />
      </Reveal>

      <Reveal index={1} style={styles.titleBlock}>
        <SWText variant="headingLarge" accessibilityRole="header">
          {listing.title}
        </SWText>
        <View style={styles.priceRow}>
          <AskingPriceBadge value={formatPeso(listing.askingPrice)} />
          <Tag label={listing.category} tone="outline" />
        </View>
      </Reveal>

      <Reveal index={2} style={styles.sections}>
        <Surface padding={tokens.spacing[4]} contentStyle={styles.assessment}>
          <SWText variant="headingSmall">Is the price fair?</SWText>
          <View style={styles.opinionRow}>
            <SWText variant="bodyCompact" tone="textMuted">
              Community vote
            </SWText>
            <SWText variant="labelSmall" tone="voteRight">
              {listing.justRightShare}% Just Right
            </SWText>
          </View>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityLabel="Community says just right"
            accessibilityValue={{ min: 0, max: 100, now: listing.justRightShare }}
          >
            <View style={[styles.fill, { width: `${listing.justRightShare}%` }]} />
          </View>
          <SWText variant="caption" tone="textMuted">
            {listing.assessmentNote}
          </SWText>
        </Surface>

        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`Seller ${listing.seller.handle}, rated ${listing.seller.rating} from ${listing.seller.sales} sales`}
          onPress={onOpenSeller}
        >
          <Surface padding={tokens.spacing[3]}>
            <View style={styles.seller}>
              <Avatar source={listing.seller.avatar} name={listing.seller.handle} size={40} />
              <View style={styles.sellerText}>
                <SWText variant="label">@{listing.seller.handle}</SWText>
                <SWText variant="caption" tone="textMuted">
                  ★ {listing.seller.rating} ({listing.seller.sales} sales)
                </SWText>
              </View>
              <ChevronRight size={20} strokeWidth={2} color={tokens.color.dark.textMuted} />
            </View>
          </Surface>
        </PressableScale>

        <View style={styles.description}>
          <SWText variant="overline" tone="textMuted" accessibilityRole="header">
            About this item
          </SWText>
          <SWText variant="bodyMedium" tone="textSecondary">
            {listing.description}
          </SWText>
        </View>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: tokens.spacing[5],
  },
  hero: {
    marginHorizontal: -tokens.layout.pageGutterCompact,
    marginBottom: tokens.spacing[3],
  },
  titleBlock: {
    gap: tokens.spacing[2],
    paddingBottom: tokens.spacing[5],
    borderBottomWidth: tokens.border.hairline,
    borderBottomColor: tokens.color.dark.borderSubtle,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sections: {
    gap: tokens.spacing[5],
  },
  assessment: {
    gap: tokens.spacing[3],
  },
  opinionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing[1],
    marginBottom: -tokens.spacing[1],
  },
  track: {
    height: tokens.spacing[2],
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.dark.surfaceRaised,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.dark.voteRight,
  },
  seller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  sellerText: {
    flex: 1,
  },
  description: {
    gap: tokens.spacing[2],
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingVertical: tokens.spacing[3],
  },
  message: {
    flex: 1,
  },
});
