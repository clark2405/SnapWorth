import { useState } from 'react';
import { View } from 'react-native';

import {
  LikeButton,
  Photo,
  SWText,
  ZoomLink,
  useToast,
  type NavLinkMenuItem,
} from '../../components';
import {
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  type SemanticColorName,
} from '../../design';
import type { VoteChoice } from '../../types';
import { formatPeso, type PreviewListing } from '../preview/sample-data';

const verdictLabel: Record<VoteChoice, string> = {
  too_high: 'Too High',
  just_right: 'Just Right',
  too_low: 'Too Low',
};

// Consistent with the vote system elsewhere: the dot and label always share one hue.
const verdictTone: Record<VoteChoice, SemanticColorName> = {
  too_high: 'voteHigh',
  just_right: 'voteRight',
  too_low: 'voteLow',
};

export interface ListingCardProps {
  readonly listing: PreviewListing;
  readonly onOpen: () => void;
  /** Optional: wired by a parent that knows the listing's seller. */
  readonly onMessageSeller?: () => void;
}

export function ListingCard({ listing, onOpen, onMessageSeller }: ListingCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const verdict = `${listing.verdictShare}% ${verdictLabel[listing.verdict]}`;

  const menu: readonly NavLinkMenuItem[] = [
    {
      title: saved ? 'Unsave' : 'Save',
      symbol: 'heart',
      onPress: () => {
        setSaved((value) => !value);
        toast.show({ title: saved ? 'Removed from saved' : 'Saved' });
      },
    },
    {
      title: 'Share',
      symbol: 'square.and.arrow.up',
      onPress: () => toast.show({ title: 'Link copied' }),
    },
    {
      title: 'Message seller',
      symbol: 'bubble.left',
      onPress: () => {
        if (onMessageSeller) onMessageSeller();
        else toast.show({ title: 'Open the listing to message the seller' });
      },
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
          radius={tokens.radius.large}
        />
        <View style={styles.like}>
          <LikeButton
            liked={saved}
            onToggle={() => setSaved((value) => !value)}
            likeLabel="Save listing"
            unlikeLabel="Remove from saved"
            appearance="glass"
            size={16}
          />
        </View>
      </View>
      <View style={styles.cardBody}>
        <SWText variant="bodyCompact" tone="textSecondary" numberOfLines={2}>
          {listing.title}
        </SWText>
        <SWText variant="priceMedium">{formatPeso(listing.askingPrice)}</SWText>
        <View style={styles.verdictRow}>
          <View style={[styles.dot, { backgroundColor: colors[verdictTone[listing.verdict]] }]} />
          <SWText variant="labelSmall" tone={verdictTone[listing.verdict]}>
            {verdict}
          </SWText>
        </View>
      </View>
    </ZoomLink>
  );
}

const stylesFor = themedStyles(() => ({
  card: {
    gap: tokens.spacing[3],
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
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    marginTop: tokens.spacing['0.5'],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
}));
