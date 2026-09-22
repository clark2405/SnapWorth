import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Heart, MessageSquare } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  GlassCard,
  GlowButton,
  IconButton,
  NavHeader,
  Photo,
  PressableScale,
  Reveal,
  Screen,
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
  const saveLabel = saved ? 'Remove from saved' : 'Save listing';

  return (
    <Screen
      header={
        <NavHeader
          title="Listing Details"
          onBack={onBack}
          banded
          trailing={
            <IconButton
              icon={Heart}
              label={saveLabel}
              tone={saved ? 'accent' : 'textPrimary'}
              onPress={() => setSaved((value) => !value)}
            />
          }
        />
      }
      footer={
        <GlassCard tone="chrome" blur radius={0} style={styles.footer}>
          <View style={styles.footerRow}>
            <PressableScale
              accessibilityLabel={saveLabel}
              accessibilityState={{ selected: saved }}
              onPress={() => setSaved((value) => !value)}
              style={styles.save}
            >
              <Heart
                size={20}
                strokeWidth={2}
                color={tokens.color.dark[saved ? 'accent' : 'textPrimary']}
              />
            </PressableScale>
            <GlowButton
              label="Message Seller to Buy"
              icon={MessageSquare}
              onPress={onMessageSeller}
              containerStyle={styles.message}
            />
          </View>
        </GlassCard>
      }
      contentStyle={styles.content}
    >
      <Reveal index={0} style={styles.hero}>
        <Photo
          source={listing.photo}
          label={listing.photoLabel}
          aspectRatio={402 / 270}
          radius={0}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[tokens.glass.scrimClear, tokens.color.dark.canvas]}
          style={styles.heroFade}
        />
      </Reveal>

      <Reveal index={1} style={styles.titleBlock}>
        <View style={styles.priceRow}>
          <SWText
            variant="priceLarge"
            accessibilityLabel={`Asking price ${formatPeso(listing.askingPrice)}`}
          >
            {formatPeso(listing.askingPrice)}
          </SWText>
          <Tag label={listing.category} tone="outline" />
        </View>
        <SWText variant="headingLarge" accessibilityRole="header">
          {listing.title}
        </SWText>
      </Reveal>

      <Reveal index={2} style={styles.sections}>
        <GlassCard padding={tokens.spacing[4]} contentStyle={styles.assessment}>
          <SWText variant="headingSmall">Value Assessment</SWText>
          <View style={styles.opinionRow}>
            <SWText variant="bodyCompact" tone="textMuted">
              Community Opinion
            </SWText>
            <SWText variant="labelSmall" tone="accent">
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
        </GlassCard>

        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`Seller ${listing.seller.handle}, rated ${listing.seller.rating} from ${listing.seller.sales} sales`}
          onPress={onOpenSeller}
        >
          <GlassCard padding={tokens.spacing[3]}>
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
          </GlassCard>
        </PressableScale>

        <View style={styles.description}>
          <SWText variant="label" accessibilityRole="header">
            Item Description
          </SWText>
          <SWText variant="bodySmall" tone="textSecondary">
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
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  titleBlock: {
    gap: tokens.spacing[2],
    paddingBottom: tokens.spacing[5],
    borderBottomWidth: tokens.border.hairline,
    borderBottomColor: tokens.glass.border,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    height: 8,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.glass.fillPressed,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.dark.accent,
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
  footer: {
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[4],
  },
  save: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.glass.fill,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.glass.border,
  },
  message: {
    flex: 1,
  },
});
