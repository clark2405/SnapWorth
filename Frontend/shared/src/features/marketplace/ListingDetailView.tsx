import {
  BadgeCheck,
  ChevronRight,
  Eye,
  Heart,
  MessageSquare,
  PencilLine,
  Trash2,
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
  DetailLayout,
  DetailSheet,
  Toggle,
  WorthySays,
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
  type PreviewConfidence,
} from '../preview/sample-data';
import { useAccountGate, useSession } from '../session';
import { askingLine } from './asking-line';
import { listingPhotoSource, sellerAvatarSource, useMarketplace } from './marketplace-state';
import { useTip } from '../tips';

export interface ListingDetailViewProps {
  readonly listingId?: string;
  readonly onBack?: () => void;
  readonly onMessageSeller?: () => void;
  /**
   * Sends an offer to the seller, into the chat about this listing. Resolves true once it's sent;
   * false when it couldn't be (the host has already said why).
   */
  readonly onSendOffer?: (amountPhp: number) => Promise<boolean>;
  readonly onOpenSeller?: (sellerHandle?: string) => void;
  /** Owner only: repost this listing to the feed so the community can vote on its price. */
  readonly onAskFeed?: () => void;
  /** Owner only: change the asking price (back through manual price confirmation). */
  readonly onEditPrice?: () => void;
  /** Owner only: close the listing as sold. */
  readonly onMarkSold?: () => void;
  /** Owner only: delete the listing. */
  readonly onDeleteListing?: () => void;
  /** Shares a link to this listing. */
  readonly onShare?: () => void;
}

const categoryDisplayLabel: Readonly<Record<string, string>> = {
  collectibles: 'Collectibles',
  fashion: 'Fashion',
  sneakers: 'Sneakers',
  electronics: 'Electronics',
  home: 'Home',
};

const roundTo50 = (value: number) => Math.max(50, Math.round(value / 50) * 50);

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
  onSendOffer,
  onOpenSeller,
  onAskFeed,
  onEditPrice,
  onMarkSold,
  onDeleteListing,
  onShare,
}: ListingDetailViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const { isGuest } = useSession();
  const requireAccount = useAccountGate();
  const {
    findListing,
    isSaved,
    getAlert,
    toggleSaved: toggleSavedInMarket,
    saveAlert,
    updateListing,
    removeListing,
  } = useMarketplace();

  const marketListing = findListing(listingId);
  // The seller sees their own listing with its numbers and controls instead of buy actions.
  const owned = !isGuest && Boolean(marketListing?.mine || listingId === previewMyListing.id);
  const fallbackListing = owned ? previewMyListing : previewListingDetail;
  const fallbackInsight = owned ? previewMyListingInsight : previewListingInsight;

  const activeId = marketListing?.id ?? fallbackListing.id;
  const title = marketListing?.title ?? fallbackListing.title;
  const categoryLabel = marketListing
    ? (categoryDisplayLabel[marketListing.category] ?? marketListing.category)
    : fallbackListing.category;
  const askingPrice = marketListing?.askingPrice ?? fallbackListing.askingPrice;
  const description =
    marketListing && marketListing.description.length > 0
      ? marketListing.description
      : fallbackListing.description;
  const justRightShare = marketListing?.verdictShare ?? fallbackListing.justRightShare;

  const seller = marketListing
    ? {
        handle: marketListing.seller.handle,
        avatar: sellerAvatarSource(marketListing.seller),
        rating: marketListing.seller.rating,
        sales: marketListing.seller.sales,
      }
    : fallbackListing.seller;

  const heroPhotos = marketListing
    ? [
        {
          source:
            marketListing.id === previewListingDetail.id && !marketListing.photoUrl
              ? previewListingDetail.photo
              : listingPhotoSource(marketListing),
          label: marketListing.photoLabel,
        },
      ]
    : photosOf(fallbackListing);

  const estimate = marketListing?.estimatePhp ?? fallbackInsight.estimate;
  const estimateLow = marketListing?.estimateLowPhp ?? fallbackInsight.estimateLow;
  const estimateHigh = marketListing?.estimateHighPhp ?? fallbackInsight.estimateHigh;
  const confidence: PreviewConfidence = fallbackInsight.confidence;
  const watchers = marketListing
    ? Math.max(1, marketListing.stats.saves)
    : fallbackInsight.watchers;
  const offerSuggestions =
    marketListing &&
    marketListing.id !== previewListingDetail.id &&
    marketListing.id !== previewMyListing.id
      ? [
          roundTo50(askingPrice * 0.88),
          roundTo50(askingPrice * 0.93),
          roundTo50(askingPrice * 0.97),
        ]
      : fallbackInsight.offerSuggestions;

  const [markingSold, setMarkingSold] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerText, setOfferText] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);

  const saved = isSaved(activeId);
  const priceAlert = getAlert(activeId)?.on ?? false;

  const saveTip = useTip('save');
  const toggleSaved = () =>
    requireAccount('save', () => {
      saveTip.done();
      void toggleSavedInMarket(activeId);
    });
  const tally = communityTally(justRightShare);
  const offerAmount = Number(offerText.replace(/,/g, '')) || 0;

  const offerNote = (() => {
    if (offerAmount <= 0) return 'Enter an amount to compare it with the AI range.';
    if (offerAmount < estimateLow) {
      return `Below the AI range of ${formatPeso(estimateLow)}–${formatPeso(estimateHigh)}.`;
    }
    if (offerAmount > estimateHigh) {
      return `Above the AI range of ${formatPeso(estimateLow)}–${formatPeso(estimateHigh)}.`;
    }
    return `Within the AI range of ${formatPeso(estimateLow)}–${formatPeso(estimateHigh)}.`;
  })();

  // The offer goes into the chat with the seller, as an offer they can accept, decline or
  // counter. If it can't be sent, the sheet stays open with the amount still in it.
  const sendOffer = async () => {
    if (offerAmount <= 0 || !onSendOffer) return;
    setSendingOffer(true);
    const sent = await onSendOffer(offerAmount);
    setSendingOffer(false);
    if (!sent) return;
    setOfferOpen(false);
    setOfferText('');
    toast.show({
      title: 'Offer sent',
      body: `${formatPeso(offerAmount)} to @${seller.handle}. They can accept, decline or counter it.`,
    });
  };

  return (
    <Screen
      ambient="market"
      bleedTop
      width="split"
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
      <DetailLayout hero={<DetailHero photos={heroPhotos} />}>
        <DetailSheet style={styles.body}>
          <Reveal index={1} style={styles.titleBlock}>
            <Tag label={categoryLabel} tone="sand" />
            <SWText variant="headingLarge" accessibilityRole="header">
              {title}
            </SWText>
            <AskingPriceBadge value={formatPeso(askingPrice)} />
          </Reveal>

          <Reveal index={2} style={styles.sections}>
            <Surface padding={tokens.spacing[4]} contentStyle={styles.assessment}>
              <SWText variant="headingSmall">Is the price fair?</SWText>
              <PriceRangeBar
                low={estimateLow}
                high={estimateHigh}
                estimate={estimate}
                confidence={confidence}
                asking={askingPrice}
                format={formatPeso}
                animate={false}
              />
              <VerdictBar tally={tally} />
            </Surface>

            <WorthySays>
              {askingLine(
                {
                  asking: askingPrice,
                  estimate,
                  low: estimateLow,
                  high: estimateHigh,
                },
                owned,
                formatPeso,
              )}
            </WorthySays>

            {owned ? (
              <OwnerPanel
                stats={marketListing?.stats ?? previewMyListing.stats}
                marking={markingSold}
                deleting={deleting}
                onMarkSold={async () => {
                  setMarkingSold(true);
                  await updateListing(activeId, { status: 'sold' });
                  setMarkingSold(false);
                  toast.show({ title: 'Marked as sold', celebrate: true });
                  onMarkSold?.();
                }}
                onDeleteListing={async () => {
                  setDeleting(true);
                  await removeListing(activeId);
                  setDeleting(false);
                  toast.show({ title: 'Listing deleted' });
                  if (onDeleteListing) onDeleteListing();
                  else onMarkSold?.();
                }}
              />
            ) : (
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`Seller ${seller.handle}, rated ${seller.rating} from ${seller.sales} sales`}
                onPress={() => onOpenSeller?.(seller.handle)}
              >
                <Surface padding={tokens.spacing[3]}>
                  <View style={styles.seller}>
                    <Avatar source={seller.avatar} name={seller.handle} size={40} ring />
                    <View style={styles.sellerText}>
                      <SWText variant="label">@{seller.handle}</SWText>
                      <Rating value={seller.rating} detail={`${seller.sales} sales`} />
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
                {description}
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
                            void saveAlert(activeId, undefined, value);
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
                  {watchers} people watching this listing
                </SWText>
              </>
            )}
          </Reveal>
        </DetailSheet>
      </DetailLayout>

      <Sheet visible={offerOpen} onClose={() => setOfferOpen(false)} title="Make an offer">
        <ChoiceChips
          kind="action"
          options={offerSuggestions.map((amount) => ({
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
          onPress={() => void sendOffer()}
        />
      </Sheet>
    </Screen>
  );
}

/** What the seller sees in place of the seller card: how the listing is doing, and closing it. */
function OwnerPanel({
  stats,
  marking,
  deleting,
  onMarkSold,
  onDeleteListing,
}: {
  readonly stats: { readonly views: number; readonly saves: number; readonly chats: number };
  readonly marking: boolean;
  readonly deleting: boolean;
  readonly onMarkSold: () => void;
  readonly onDeleteListing: () => void;
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
      <Button
        label="Delete listing"
        variant="tertiary"
        icon={Trash2}
        loading={deleting}
        onPress={onDeleteListing}
      />
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  // No gap: the sheet must sit right on the photo so its rounded top overlaps it fully.
  content: {
    paddingTop: 0,
    paddingHorizontal: 0,
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
