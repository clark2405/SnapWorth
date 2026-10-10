import {
  BadgeCheck,
  ChevronRight,
  Eye,
  Heart,
  MessageSquare,
  PencilLine,
  Users,
} from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Tag,
  AskingPriceBadge,
  Avatar,
  BottomBar,
  Button,
  ChoiceChips,
  IconButton,
  LikeButton,
  ListRow,
  NavHeader,
  Rating,
  PressableScale,
  Reveal,
  PriceRangeBar,
  Screen,
  Sheet,
  Surface,
  SWText,
  useToast,
  VerdictBar,
  TextField,
  shareIcon,
  DetailHero,
  DetailSheet,
  Toggle,
} from '../../components';
import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import type { VoteCounts } from '../../types';
import {
  formatPeso,
  photosOf,
  previewListingDetail,
  previewListingInsight,
  previewMyListing,
  previewMyListingInsight,
} from '../preview/sample-data';
import { useAccountGate, useSession } from '../session';
import { useTip } from '../tips';

export interface ListingDetailViewProps {
  readonly listingId?: string;
  readonly onBack?: () => void;
  readonly onMessageSeller?: () => void;
  readonly onOpenSeller?: () => void;
  /** Owner only: repost this listing to the feed so the community can vote on its price. */
  readonly onAskFeed?: () => void;
  /** Owner only: change the asking price (back through manual price confirmation). */
  readonly onEditPrice?: () => void;
  /** Owner only: close the listing as sold. */
  readonly onMarkSold?: () => void;
  /** Shares a link to this listing. */
  readonly onShare?: () => void;
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
  listingId,
  onBack,
  onMessageSeller,
  onOpenSeller,
  onAskFeed,
  onEditPrice,
  onMarkSold,
  onShare,
}: ListingDetailViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const { isGuest } = useSession();
  const requireAccount = useAccountGate();
  // The seller sees their own listing with its numbers and controls instead of buy actions.
  const owned = !isGuest && listingId === previewMyListing.id;
  const listing = owned ? previewMyListing : previewListingDetail;
  const insight = owned ? previewMyListingInsight : previewListingInsight;
  const [markingSold, setMarkingSold] = useState(false);

  const [saved, setSaved] = useState(false);
  const [priceAlert, setPriceAlert] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerText, setOfferText] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);

  const saveTip = useTip('save');
  const toggleSaved = () =>
    requireAccount('save', () => {
      saveTip.done();
      setSaved((value) => !value);
    });
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
              {onShare ? (
                <IconButton
                  icon={shareIcon}
                  label="Share this listing"
                  appearance="glass"
                  onPress={onShare}
                />
              ) : null}
              {owned ? null : (
                <LikeButton
                  liked={saved}
                  onToggle={toggleSaved}
                  likeLabel="Save listing"
                  unlikeLabel="Remove from saved"
                  appearance="glass"
                />
              )}
            </View>
          }
        />
      }
      footer={
        owned ? (
          <BottomBar>
            <View style={styles.footerRow}>
              <Button
                label="Ask the feed"
                variant="secondary"
                icon={Users}
                accessibilityHint="Reposts this listing so the community can vote on its price."
                onPress={onAskFeed}
                containerStyle={styles.footerButton}
              />
              <Button
                label="Edit price"
                icon={PencilLine}
                onPress={onEditPrice}
                containerStyle={styles.footerButton}
              />
            </View>
          </BottomBar>
        ) : (
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
                onPress={() => requireAccount('offer', () => setOfferOpen(true))}
                containerStyle={styles.footerButton}
              />
              <Button
                label="Message"
                icon={MessageSquare}
                onPress={() => requireAccount('message', onMessageSeller)}
                containerStyle={styles.footerButton}
              />
            </View>
          </BottomBar>
        )
      }
      contentStyle={styles.content}
    >
      {/* The zoom lands on the hero photo, which has no entrance of its own: a fade or slide on
          top of the zoom made opening and closing a listing stutter. */}
      <DetailHero photos={photosOf(listing)} />

      <DetailSheet style={styles.body}>
        <Reveal index={1} style={styles.titleBlock}>
          <Tag label={listing.category} tone="sand" />
          <SWText variant="headingLarge" accessibilityRole="header">
            {listing.title}
          </SWText>
          <AskingPriceBadge value={formatPeso(listing.askingPrice)} />
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
              animate={false}
            />
            <VerdictBar tally={tally} />
          </Surface>

          {owned ? (
            <OwnerPanel
              stats={previewMyListing.stats}
              marking={markingSold}
              onMarkSold={() => {
                setMarkingSold(true);
                setTimeout(() => {
                  setMarkingSold(false);
                  toast.show({ title: 'Marked as sold', celebrate: true });
                  onMarkSold?.();
                }, 700);
              }}
            />
          ) : (
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
                    <Rating
                      value={listing.seller.rating}
                      detail={`${listing.seller.sales} sales`}
                    />
                  </View>
                  <ChevronRight size={20} strokeWidth={2} color={colors.textMuted} />
                </View>
              </Surface>
            </PressableScale>
          )}

          <View style={styles.description}>
            <SWText variant="overline" tone="textMuted" accessibilityRole="header">
              About this item
            </SWText>
            <SWText variant="bodyMedium" tone="textSecondary">
              {listing.description}
            </SWText>
          </View>

          {owned ? null : (
            <>
              <Surface>
                <ListRow
                  label="Alert me if the price drops"
                  trailing={
                    <Toggle
                      value={priceAlert}
                      onValueChange={(value) =>
                        requireAccount('alert', () => {
                          setPriceAlert(value);
                          if (value) {
                            haptic('select');
                            toast.show({
                              title: 'Alert set',
                              body: "We'll notify you if the price drops.",
                            });
                          }
                        })
                      }
                      accessibilityLabel="Alert me if the price drops"
                    />
                  }
                />
              </Surface>
              <SWText variant="caption" tone="textMuted">
                {insight.watchers} people watching this listing
              </SWText>
            </>
          )}
        </Reveal>
      </DetailSheet>

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

/** What the seller sees in place of the seller card: how the listing is doing, and closing it. */
function OwnerPanel({
  stats,
  marking,
  onMarkSold,
}: {
  readonly stats: { readonly views: number; readonly saves: number; readonly chats: number };
  readonly marking: boolean;
  readonly onMarkSold: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const tiles = [
    { label: 'Views', value: stats.views, icon: Eye },
    { label: 'Saves', value: stats.saves, icon: Heart },
    { label: 'Chats', value: stats.chats, icon: MessageSquare },
  ];
  return (
    <View style={styles.owner}>
      <View style={styles.ownerStats}>
        {tiles.map(({ label, value, icon: Icon }) => (
          <Surface
            key={label}
            padding={tokens.spacing[3]}
            style={styles.ownerTile}
            contentStyle={styles.ownerTileContent}
          >
            <View accessible accessibilityLabel={`${value} ${label.toLowerCase()}`}>
              <Icon size={16} strokeWidth={2} color={colors.textMuted} />
              <SWText variant="priceSmall">{String(value)}</SWText>
              <SWText variant="caption" tone="textSecondary">
                {label}
              </SWText>
            </View>
          </Surface>
        ))}
      </View>
      <Button
        label="Mark as sold"
        variant="secondary"
        icon={BadgeCheck}
        loading={marking}
        onPress={onMarkSold}
      />
    </View>
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
    gap: tokens.spacing[5],
  },
  titleBlock: {
    gap: tokens.spacing[2],
    paddingBottom: tokens.spacing[5],
    borderBottomWidth: tokens.border.hairline,
    borderBottomColor: colors.borderSubtle,
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
    gap: tokens.spacing[2],
  },
  footerButton: {
    flex: 1,
  },
  owner: {
    gap: tokens.spacing[3],
  },
  ownerStats: {
    flexDirection: 'row',
    gap: tokens.spacing[2],
  },
  ownerTile: {
    flex: 1,
  },
  ownerTileContent: {
    gap: tokens.spacing[1],
  },
}));
