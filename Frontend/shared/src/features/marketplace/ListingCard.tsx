import { CircleCheck, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  LikeButton,
  Photo,
  SWText,
  Tag,
  ZoomLink,
  useToast,
  type NavLinkMenuItem,
  type TagTone,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import type { VoteChoice } from '../../types';
import { formatPeso, type PreviewListing } from '../preview/sample-data';
import { useAccountGate } from '../session';
import { useTip } from '../tips';

const verdictLabel: Record<VoteChoice, string> = {
  too_high: 'Too High',
  just_right: 'Just Right',
  too_low: 'Too Low',
};

// The community verdict is a status, so it wears a soft tonal chip, never a bright colour.
const verdictChip: Record<VoteChoice, { tone: TagTone; icon: LucideIcon }> = {
  too_high: { tone: 'warn', icon: TrendingUp },
  just_right: { tone: 'mint', icon: CircleCheck },
  too_low: { tone: 'sand', icon: TrendingDown },
};

export interface ListingCardProps {
  readonly listing: PreviewListing;
  readonly onOpen: () => void;
  /** Optional: wired by a parent that knows the listing's seller. */
  readonly onMessageSeller?: () => void;
}

export function ListingCard({ listing, onOpen, onMessageSeller }: ListingCardProps) {
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const requireAccount = useAccountGate();
  const saveTip = useTip('save');
  const verdict = `${listing.verdictShare}% ${verdictLabel[listing.verdict]}`;

  const menu: readonly NavLinkMenuItem[] = [
    {
      title: saved ? 'Unsave' : 'Save',
      symbol: 'heart',
      onPress: () =>
        requireAccount('save', () => {
          saveTip.done();
          setSaved((value) => !value);
          toast.show({ title: saved ? 'Removed from saved' : 'Saved' });
        }),
    },
    {
      title: 'Share',
      symbol: 'square.and.arrow.up',
      onPress: () => toast.show({ title: 'Link copied' }),
    },
    {
      title: 'Message seller',
      symbol: 'bubble.left',
      onPress: () =>
        requireAccount('message', () => {
          if (onMessageSeller) onMessageSeller();
          else toast.show({ title: 'Open the listing to message the seller' });
        }),
    },
  ];

  return (
    <ZoomLink
      href={`/listing/${listing.id}`}
      label={`${listing.title}, asking ${formatPeso(listing.askingPrice)}, community says ${verdict}`}
      onPress={onOpen}
      menu={menu}
      style={styles.card}
    >
      <View style={styles.photoWrap}>
        <Photo
          source={listing.photo}
          label={listing.photoLabel}
          aspectRatio={4 / 5}
          radius={tokens.radius.medium}
        />
        <View style={styles.like}>
          <LikeButton
            liked={saved}
            onToggle={() =>
              requireAccount('save', () => {
                saveTip.done();
                setSaved((value) => !value);
              })
            }
            likeLabel="Save listing"
            unlikeLabel="Remove from saved"
            appearance="glass"
            size={16}
          />
        </View>
      </View>
      <View style={styles.cardBody}>
        <SWText
          variant="bodyCompact"
          tone="textSecondary"
          numberOfLines={2}
          style={styles.cardTitle}
        >
          {listing.title}
        </SWText>
        <SWText variant="priceMedium">{formatPeso(listing.askingPrice)}</SWText>
        <View style={styles.verdictRow}>
          <Tag
            label={verdict}
            tone={verdictChip[listing.verdict].tone}
            icon={verdictChip[listing.verdict].icon}
          />
        </View>
      </View>
    </ZoomLink>
  );
}

const stylesFor = themedStyles((colors, name) => ({
  card: {
    gap: tokens.spacing[3],
    padding: tokens.spacing[2],
    paddingBottom: tokens.spacing[3],
    borderRadius: tokens.radius.large,
    backgroundColor: colors.surface,
    borderWidth: name === 'dark' ? StyleSheet.hairlineWidth : 0,
    borderColor: colors.borderSubtle,
    shadowColor: tokens.shadow[name],
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  photoWrap: {
    position: 'relative',
  },
  like: {
    position: 'absolute',
    top: tokens.spacing[2],
    right: tokens.spacing[2],
  },
  cardBody: {
    gap: tokens.spacing['0.5'],
    paddingHorizontal: tokens.spacing[2],
  },
  // Two lines reserved for every title, so prices line up across the grid.
  cardTitle: {
    minHeight: tokens.typography.style.bodyCompact.lineHeight * 2,
  },
  verdictRow: {
    flexDirection: 'row',
    marginTop: tokens.spacing[1],
  },
}));
