import { Flag, FolderHeart, MessageCircle, MessageSquareText, UserX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  paperIn,
  paperLayout,
  Avatar,
  Button,
  EmptyState,
  Photo,
  PressableScale,
  IconButton,
  NavHeader,
  Rating,
  Reveal,
  Screen,
  ScreenSkeleton,
  Sheet,
  SWText,
} from '../../components';
import { held, themedStyles, tokens, useThemedStyles } from '../../design';
import type { ProfileCollection, SellerProfile } from '../../ports/marketplace';
import { toPreviewPost, useFeed } from '../feed/feed-state';
import { formatPeso, type PreviewPost } from '../preview/sample-data';
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
  readonly onOpenPost?: (postId: string) => void;
  /** Opens (or reopens) a chat with them about one of their listings, by its slug. */
  readonly onMessage?: (listingSlug: string) => void;
  /** Report and block live here, as they do in chat (SRS 3.1.10). */
  readonly onReport?: () => void;
}

export function SellerProfileView({
  handle,
  onBack,
  onOpenListing,
  onOpenPost,
  onMessage,
  onReport,
}: SellerProfileViewProps) {
  const styles = useThemedStyles(stylesFor);
  const requireAccount = useAccountGate();
  const { loadSeller } = useMarketplace();
  const { posts: feedPosts } = useFeed();
  const normalized = handle?.trim().toLowerCase().replace(/^@/, '');

  // `undefined` while the seller is being looked up; `null` once they're known not to exist.
  const [seller, setSeller] = useState<SellerProfile | null | undefined>(undefined);
  const [picking, setPicking] = useState(false);

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
      <Screen ambient="market" header={<NavHeader title="Profile" onBack={onBack} />}>
        <EmptyState
          icon={UserX}
          title="Profile not found"
          body="This account may have been removed or the link is out of date."
          actionLabel="Go back"
          onAction={onBack}
        />
      </Screen>
    );
  }

  const listings = seller.listings.map(toPreviewListing);
  const avatar = sellerAvatarSource(seller);
  // Their posts, from the ones the Feed has: published ones, or all of them if they're yours.
  const posts = feedPosts
    .filter(
      (post) =>
        post.author.userId === seller.id && (post.moderationStatus === 'approved' || post.isMine),
    )
    .map(toPreviewPost);
  const collections = seller.collections ?? [];
  // Chats are about a listing: with one, Message goes straight to it; with more, you pick.
  const mine = seller.listings.some((listing) => listing.mine);
  const canMessage = Boolean(onMessage) && !mine && seller.listings.length > 0;
  const message = (slug: string) => requireAccount('message', () => onMessage?.(slug));
  const messageThem = () => {
    const only = seller.listings.length === 1 ? seller.listings[0] : undefined;
    if (only) message(only.slug);
    else setPicking(true);
  };

  return (
    <Screen
      ambient="market"
      header={
        <NavHeader
          title={`@${seller.handle}`}
          onBack={onBack}
          // A shell with nowhere to report from (the moderators' website) shows no button.
          trailing={
            onReport ? (
              <IconButton
                icon={Flag}
                label="Report or block this person"
                onPress={() => requireAccount('report', onReport)}
              />
            ) : undefined
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

      {canMessage ? (
        <Reveal index={1}>
          <Button label={`Message @${seller.handle}`} icon={MessageCircle} onPress={messageThem} />
        </Reveal>
      ) : null}

      <Reveal index={2} style={styles.stats}>
        <Stat value={posts.length} label={posts.length === 1 ? 'Post' : 'Posts'} />
        <Stat value={listings.length} label={listings.length === 1 ? 'Listing' : 'Listings'} />
        <Stat value={seller.sales} label={seller.sales === 1 ? 'Sale' : 'Sales'} />
      </Reveal>

      <Reveal index={3} style={styles.section}>
        <SWText variant="overline" tone="textMuted" accessibilityRole="header">
          {`Posts · ${posts.length}`}
        </SWText>
        {posts.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title="No posts yet"
            body="When they ask the community about a price, it shows up here."
          />
        ) : (
          <View style={styles.rows}>
            {posts.map((post) => (
              <PostRow key={post.id} post={post} onOpen={() => onOpenPost?.(post.id)} />
            ))}
          </View>
        )}
      </Reveal>

      {collections.length > 0 ? (
        <Reveal index={4} style={styles.section}>
          <SWText variant="overline" tone="textMuted" accessibilityRole="header">
            {`Collections · ${collections.length}`}
          </SWText>
          <View style={styles.rows}>
            {collections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </View>
        </Reveal>
      ) : null}

      <Reveal index={5} style={styles.section}>
        <SWText variant="overline" tone="textMuted" accessibilityRole="header">
          {`Listings · ${listings.length}`}
        </SWText>
        {listings.length === 0 ? (
          <EmptyState
            icon={UserX}
            title="Nothing for sale right now"
            body="Nothing of theirs is for sale right now."
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
                <ListingCard
                  listing={listing}
                  onOpen={() => onOpenListing?.(listing.id)}
                  onMessageSeller={canMessage ? () => onMessage?.(listing.id) : undefined}
                />
                {canMessage ? (
                  <Button
                    label="Message"
                    variant="secondary"
                    size="small"
                    icon={MessageCircle}
                    onPress={() => message(listing.id)}
                  />
                ) : null}
              </Animated.View>
            ))}
          </View>
        )}
      </Reveal>
      <Sheet
        visible={picking}
        onClose={() => setPicking(false)}
        title={`Message @${seller.handle} about…`}
      >
        <View style={styles.rows}>
          {seller.listings.map((listing) => (
            <Button
              key={listing.id}
              label={`${listing.title} · ${formatPeso(listing.askingPrice)}`}
              variant="secondary"
              onPress={() => {
                setPicking(false);
                message(listing.slug);
              }}
            />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

function Stat({ value, label }: { readonly value: number; readonly label: string }) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <SWText variant="headingLarge">{String(value)}</SWText>
      <SWText variant="caption" tone="textMuted">
        {label}
      </SWText>
    </View>
  );
}

/** One of their posts: the photo, what they asked, and the AI's figure if there is one. */
function PostRow({ post, onOpen }: { readonly post: PreviewPost; readonly onOpen: () => void }) {
  const styles = useThemedStyles(stylesFor);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${post.body}. Opens the post`}
      onPress={onOpen}
      style={styles.row}
    >
      <Photo source={post.photo} label={post.photoLabel} style={styles.rowPhoto} />
      <View style={styles.rowText}>
        <SWText variant="bodyMedium" numberOfLines={2}>
          {post.body}
        </SWText>
        <SWText variant="caption" tone="textMuted">
          {post.estimate === null
            ? post.postedAgo
            : `AI ${formatPeso(post.estimate)} · ${post.postedAgo}`}
        </SWText>
      </View>
    </PressableScale>
  );
}

/** A collection they show: its name, how much is in it and what it's worth together. */
function CollectionCard({ collection }: { readonly collection: ProfileCollection }) {
  const styles = useThemedStyles(stylesFor);
  const { itemCount, totalPhp, itemNames } = collection;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${collection.name}, ${itemCount} items worth about ${formatPeso(totalPhp)}`}
    >
      <View style={styles.collectionIcon}>
        <FolderHeart size={22} strokeWidth={1.8} color={styles.collectionGlyph.color} />
      </View>
      <View style={styles.rowText}>
        <SWText variant="headingSmall">{collection.name}</SWText>
        <SWText variant="caption" tone="textMuted">
          {`${itemCount === 1 ? '1 item' : `${itemCount} items`} · about ${formatPeso(totalPhp)}`}
        </SWText>
        {itemNames.length > 0 ? (
          <SWText variant="caption" tone="textSecondary" numberOfLines={1}>
            {itemNames.join(' · ')}
          </SWText>
        ) : null}
      </View>
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  stats: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
  },
  stat: {
    flex: 1,
    alignItems: 'flex-start',
    padding: tokens.spacing[3],
    borderRadius: tokens.radius.large,
    backgroundColor: colors.surface,
    ...held(colors, 2),
  },
  rows: {
    gap: tokens.spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    padding: tokens.spacing[2],
    borderRadius: tokens.radius.large,
    backgroundColor: colors.surface,
    ...held(colors, 2),
  },
  rowPhoto: {
    width: 64,
    height: 64,
  },
  rowText: {
    flex: 1,
    gap: tokens.spacing[1],
  },
  collectionIcon: {
    width: 64,
    height: 64,
    borderRadius: tokens.radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  collectionGlyph: {
    color: colors.textSecondary,
  },
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
