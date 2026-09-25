import { ChevronRight, MessageSquare, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import {
  AskingPriceBadge,
  Avatar,
  BottomBar,
  Button,
  ChoiceChips,
  IconButton,
  LikeButton,
  ListRow,
  NavHeader,
  Photo,
  PressableScale,
  PriceRangeBar,
  Reveal,
  Screen,
  Sheet,
  Surface,
  SWText,
  Tag,
  TextField,
  VerdictBar,
  ZoomTarget,
  useToast,
} from '../../components';
import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import type { VoteCounts } from '../../types';
import { formatPeso, previewListingDetail, previewListingInsight } from '../preview/sample-data';

export interface ListingDetailViewProps {
  readonly listingId?: string;
  readonly onBack?: () => void;
  readonly onMessageSeller?: () => void;
  readonly onOpenSeller?: () => void;
}

function communityTally(justRightShare: number): VoteCounts {
  const remainder = 100 - justRightShare;
  return {
    just_right: justRightShare,
    too_high: Math.round(remainder * 0.6),
    too_low: Math.round(remainder * 0.4),
  };
}

export function ListingDetailView({
  onBack,
  onMessageSeller,
  onOpenSeller,
}: ListingDetailViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const listing = previewListingDetail;
  const insight = previewListingInsight;

  const [saved, setSaved] = useState(false);
  const [priceAlert, setPriceAlert] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerText, setOfferText] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);

  const toggleSaved = () => setSaved((value) => !value);
  const tally = communityTally(listing.justRightShare);
  const offerAmount = Number(offerText.replace(/,/g, '')) || 0;

  const offerNote = (() => {
    if (offerAmount <= 0) return 'Enter an amount to compare it with the AI range.';
    if (offerAmount < insight.estimateLow) {
      return `Below the AI range of ${formatPeso(insight.estimateLow)}–${formatPeso(insight.estimateHigh)}.`;
    }
    if (offerAmount > insight.estimateHigh) {
      return `Above the AI range of ${formatPeso(insight.estimateLow)}–${formatPeso(insight.estimateHigh)}.`;
    }
    return `Within the AI range of ${formatPeso(insight.estimateLow)}–${formatPeso(insight.estimateHigh)}.`;
  })();

  const sendOffer = () => {
    if (offerAmount <= 0) return;
    setSendingOffer(true);
    setTimeout(() => {
      setSendingOffer(false);
      setOfferOpen(false);
      toast.show({
        title: 'Offer sent',
        body: `${formatPeso(offerAmount)} sent to @${listing.seller.handle}.`,
      });
    }, 800);
  };

  return (
    <Screen
      bleedTop
      header={
        <NavHeader
          title="Listing"
          onBack={onBack}
          trailing={
            <View style={styles.headerActions}>
              <IconButton
                icon={Share2}
                label="Share this listing"
                appearance="glass"
                onPress={() => toast.show({ title: 'Link copied' })}
              />
              <LikeButton
                liked={saved}
                onToggle={toggleSaved}
                likeLabel="Save listing"
                unlikeLabel="Remove from saved"
                appearance="glass"
              />
            </View>
          }
        />
      }
      footer={
        <BottomBar>
          <View style={styles.footerRow}>
            <LikeButton
              liked={saved}
              onToggle={toggleSaved}
              likeLabel="Save listing"
              unlikeLabel="Remove from saved"
              appearance="outline"
              size={20}
            />
            <Button
              label="Make offer"
              variant="secondary"
              onPress={() => setOfferOpen(true)}
              containerStyle={styles.footerButton}
            />
            <Button
              label="Message"
              icon={MessageSquare}
              onPress={onMessageSeller}
              containerStyle={styles.footerButton}
            />
          </View>
        </BottomBar>
      }
      contentStyle={styles.content}
    >
      <ZoomTarget>
        <Reveal index={0}>
          <Photo source={listing.photo} label={listing.photoLabel} aspectRatio={4 / 3} radius={0} />
        </Reveal>
      </ZoomTarget>

      <View style={styles.body}>
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
            <PriceRangeBar
              low={insight.estimateLow}
              high={insight.estimateHigh}
              estimate={insight.estimate}
              confidence={insight.confidence}
              asking={listing.askingPrice}
              format={formatPeso}
            />
            <VerdictBar tally={tally} />
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
                <Avatar
                  source={listing.seller.avatar}
                  name={listing.seller.handle}
                  size={40}
                  ring
                />
                <View style={styles.sellerText}>
                  <SWText variant="label">@{listing.seller.handle}</SWText>
                  <SWText variant="caption" tone="textMuted">
                    ★ {listing.seller.rating} ({listing.seller.sales} sales)
                  </SWText>
                </View>
                <ChevronRight size={20} strokeWidth={2} color={colors.textMuted} />
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

          <Surface>
            <ListRow
              label="Alert me if the price drops"
              trailing={
                <Switch
                  value={priceAlert}
                  onValueChange={(value) => {
                    setPriceAlert(value);
                    if (value) {
                      haptic('select');
                      toast.show({
                        title: 'Alert set',
                        body: "We'll notify you if the price drops.",
                      });
                    }
                  }}
                  trackColor={{ false: colors.sunken, true: colors.accent }}
                  accessibilityLabel="Alert me if the price drops"
                />
              }
            />
          </Surface>
          <SWText variant="caption" tone="textMuted">
            {insight.watchers} people watching this listing
          </SWText>
        </Reveal>
      </View>

      <Sheet visible={offerOpen} onClose={() => setOfferOpen(false)} title="Make an offer">
        <ChoiceChips
          options={insight.offerSuggestions.map((amount) => ({
            key: String(amount),
            label: formatPeso(amount),
          }))}
          value={offerAmount > 0 ? String(offerAmount) : null}
          onChange={(key) => setOfferText(key)}
        />
        <TextField
          size="large"
          prefix="₱"
          value={offerText}
          onChangeText={setOfferText}
          placeholder="Enter your offer"
          keyboardType="decimal-pad"
          inputMode="decimal"
          accessibilityLabel="Your offer in pesos"
        />
        <SWText variant="caption" tone="textMuted">
          {offerNote}
        </SWText>
        <Button
          label="Send offer"
          disabled={offerAmount <= 0}
          loading={sendingOffer}
          onPress={sendOffer}
        />
      </Sheet>
    </Screen>
  );
}

const stylesFor = themedStyles((colors) => ({
  content: {
    paddingTop: 0,
    paddingHorizontal: 0,
    gap: tokens.spacing[5],
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  body: {
    paddingHorizontal: tokens.layout.pageGutterCompact,
    gap: tokens.spacing[5],
  },
  titleBlock: {
    gap: tokens.spacing[2],
    paddingBottom: tokens.spacing[5],
    borderBottomWidth: tokens.border.hairline,
    borderBottomColor: colors.borderSubtle,
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
  footerButton: {
    flex: 1,
  },
}));
