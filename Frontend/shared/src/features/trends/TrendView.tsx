import { ChevronRight, Flame } from 'lucide-react-native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import {
  Button,
  DetailHero,
  DetailLayout,
  DetailSheet,
  EmptyState,
  NavHeader,
  Photo,
  PressableScale,
  Reveal,
  Screen,
  ShareButton,
  Sign,
  SnapIcon,
  Sparkline,
  Sticker,
  SWText,
  ZoomTarget,
} from '../../components';
import { held, themedStyles, tokens, useTheme, useThemedStyles, useWideLayout } from '../../design';
import { toPreviewPost } from '../feed/feed-state';
import { ListingCard } from '../marketplace/ListingCard';
import { toPreviewListing } from '../marketplace/marketplace-state';
import { formatPeso } from '../preview/sample-data';
import { useTrends } from './use-trends';

export interface TrendViewProps {
  /** A "Hot this month" key, e.g. `film-cameras`. */
  readonly trendKey?: string;
  readonly onBack?: () => void;
  readonly onShare?: () => void;
  readonly onOpenListing?: (listingId: string) => void;
  readonly onOpenPost?: (postId: string) => void;
  readonly onSnap?: () => void;
}

/**
 * One trending category, told as a story rather than a search: the photo runs full bleed and the
 * category is set big over it, then what it sells for, how that moved, why, and what is for sale
 * and being priced right now. Brand lives in this content; the navigation stays standard.
 */
export function TrendView({
  trendKey,
  onBack,
  onShare,
  onOpenListing,
  onOpenPost,
  onSnap,
}: TrendViewProps) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const { trends, detailFor, listingsFor, postsFor } = useTrends();
  // Every hook runs before the not-found return below: the trends arrive after the first render,
  // and a hook that only runs once they are here changes the hook order and crashes the screen.
  const wide = useWideLayout();
  const trend = trends.find((entry) => entry.key === trendKey);
  const detail = trend ? detailFor(trend.key) : undefined;

  if (!trend || !detail) {
    return (
      <Screen ambient="feed" header={<NavHeader title="Trending" onBack={onBack} banded />}>
        <EmptyState
          icon={Flame}
          title="This trend has cooled off"
          body="It is not in this month's list any more. See what is hot on the feed."
          actionLabel="Back to the feed"
          onAction={onBack}
        />
      </Screen>
    );
  }

  const rising = trend.change === null || !trend.change.trim().startsWith('−');
  const listings = listingsFor(trend.key).map(toPreviewListing);
  const posts = postsFor(trend.key).map(toPreviewPost);
  const heroHeight = Math.round(height * 0.5);
  // On a wide window the photo is framed on the left and the title heads the details beside it.
  const title = (
    <>
      <Sign icon={Flame} label={detail.badge} />
      <SWText variant="displayHero" accessibilityRole="header">
        {trend.label}
      </SWText>
      {trend.change === null ? null : (
        <Sticker
          label={`${trend.change} this month`}
          tone={rising ? 'marigold' : 'cobalt'}
          style={styles.heroSticker}
        />
      )}
    </>
  );

  return (
    <Screen
      ambient="feed"
      bleedTop
      width="split"
      header={
        <NavHeader
          title={trend.label}
          onBack={onBack}
          trailing={<ShareButton label={`Share ${trend.label}`} onPress={onShare} />}
        />
      }
      contentStyle={styles.content}
    >
      {wide ? null : (
        <View style={[styles.hero, { height: heroHeight }]}>
          <ZoomTarget>
            <Photo
              source={trend.photo}
              label={trend.label}
              radius={0}
              style={StyleSheet.absoluteFill}
            />
          </ZoomTarget>
          {/* The photo melts into the page so the title can sit across both. A web SVG needs its
              size spelled out, or it takes the browser's default 300 × 150 box. */}
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id="trend-fade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.45" stopColor={colors.canvas} stopOpacity={0} />
                <Stop offset="1" stopColor={colors.canvas} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#trend-fade)" />
          </Svg>
          <View style={styles.heroText}>{title}</View>
        </View>
      )}

      <DetailLayout
        hero={wide ? <DetailHero source={trend.photo ?? undefined} label={trend.label} /> : null}
      >
        {/* The photo fades into the page colour, and the body carries that same colour all the way
          down, so there is no step between the hero and the content. */}
        <DetailSheet style={styles.body}>
          {wide ? <View style={styles.titleBeside}>{title}</View> : null}
          {detail.headline === null ? null : (
            <Reveal index={0}>
              <SWText variant="headingLarge">{detail.headline}</SWText>
            </Reveal>
          )}

          <Reveal index={1}>
            {/* The month's number gets the loudest colour in the brand: this is what's hot. */}
            <View style={styles.priceCard}>
              <SWText variant="overline" color={colors.onMarigold}>
                Typical price
              </SWText>
              <SWText variant="priceHero" color={colors.onMarigold}>
                {formatPeso(detail.typicalPrice)}
              </SWText>
              <SWText variant="bodySmall" color={colors.onMarigold}>
                {detail.soldThisMonth === null
                  ? `Most are asking between ${formatPeso(detail.low)} and ${formatPeso(detail.high)}`
                  : `Most sell between ${formatPeso(detail.low)} and ${formatPeso(detail.high)}`}
              </SWText>
              {detail.series.length > 0 ? (
                <Sparkline values={detail.series} height={72} color={colors.onMarigold} />
              ) : null}
              <View style={styles.statRow}>
                {detail.soldThisMonth === null ? (
                  <Stat label="Listed this month" value={String(detail.listedThisMonth ?? 0)} />
                ) : (
                  <Stat label="Sold this month" value={String(detail.soldThisMonth)} />
                )}
                <Stat label={detail.changeLabel} value={trend.change ?? '—'} />
              </View>
            </View>
          </Reveal>

          {detail.why === null ? null : (
            <Reveal index={2} style={styles.section}>
              <SWText variant="headingMedium" accessibilityRole="header">
                Why it&apos;s hot
              </SWText>
              <SWText variant="bodyLarge" tone="textSecondary">
                {detail.why}
              </SWText>
            </Reveal>
          )}

          <Reveal index={3} style={styles.section}>
            <SWText variant="headingMedium" accessibilityRole="header">
              For sale now
            </SWText>
            {listings.length > 0 ? (
              <View style={styles.grid}>
                {listings.map((listing) => (
                  <View key={listing.id} style={styles.cell}>
                    <ListingCard listing={listing} onOpen={() => onOpenListing?.(listing.id)} />
                  </View>
                ))}
                {listings.length % 2 === 1 ? <View style={styles.cell} /> : null}
              </View>
            ) : (
              <SWText variant="bodyMedium" tone="textMuted">
                Nothing listed right now. Have one? You could be the first.
              </SWText>
            )}
          </Reveal>

          {posts.length > 0 ? (
            <Reveal index={4} style={styles.section}>
              <SWText variant="headingMedium" accessibilityRole="header">
                Being priced on the feed
              </SWText>
              <View>
                {posts.map((post, index) => (
                  <PressableScale
                    key={post.id}
                    accessibilityRole="link"
                    accessibilityLabel={`Open discussion: ${post.body}`}
                    haptic="select"
                    depth="surface"
                    onPress={() => onOpenPost?.(post.id)}
                    style={[styles.postRow, index > 0 ? styles.divided : null]}
                  >
                    <Photo
                      source={post.photo}
                      label={post.photoLabel}
                      radius={tokens.radius.medium}
                      style={styles.postThumb}
                    />
                    <View style={styles.postText}>
                      <SWText variant="bodyMedium" numberOfLines={2}>
                        {post.body}
                      </SWText>
                      <SWText variant="caption" tone="textMuted">
                        {post.estimate === null
                          ? post.postedAgo
                          : `AI est. ${formatPeso(post.estimate)} · ${post.postedAgo}`}
                      </SWText>
                    </View>
                    <ChevronRight size={18} strokeWidth={2} color={colors.textMuted} />
                  </PressableScale>
                ))}
              </View>
            </Reveal>
          ) : null}

          <Reveal index={5}>
            <View style={styles.cta}>
              <SWText variant="headingLarge" color={colors.onCobalt}>
                Got one?
              </SWText>
              <SWText variant="bodyMedium" color={colors.onCobalt}>
                {trend.change === null
                  ? `Snap it to see what yours is worth.`
                  : `Snap it to see what yours is worth while ${trend.label.toLowerCase()} are ${rising ? 'up' : 'moving'}.`}
              </SWText>
              <Button label="Snap it" variant="accent" icon={SnapIcon} onPress={onSnap} />
            </View>
          </Reveal>
        </DetailSheet>
      </DetailLayout>
    </Screen>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <SWText variant="priceSmall" color={colors.onMarigold}>
        {value}
      </SWText>
      <SWText variant="caption" color={colors.onMarigold}>
        {label}
      </SWText>
    </View>
  );
}

const gutter = tokens.layout.pageGutterCompact;

const stylesFor = themedStyles((colors) => ({
  content: {
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  hero: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.sunken,
  },
  heroText: {
    position: 'absolute',
    left: gutter,
    right: gutter,
    bottom: tokens.spacing[2],
    gap: tokens.spacing[2],
    alignItems: 'flex-start',
  },
  // Flat to the hero: the photo fades into it rather than the sheet overlapping the photo.
  titleBeside: {
    gap: tokens.spacing[2],
    alignItems: 'flex-start',
  },
  body: {
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: tokens.spacing[5],
    gap: tokens.spacing[8],
  },
  heroSticker: {
    marginTop: tokens.spacing[1],
  },
  priceCard: {
    gap: tokens.spacing[2],
    padding: tokens.spacing[5],
    borderRadius: tokens.radius.large,
    backgroundColor: colors.marigold,
    ...held(colors),
  },
  statRow: {
    flexDirection: 'row',
    gap: tokens.spacing[6],
    marginTop: tokens.spacing[2],
  },
  stat: {
    gap: 2,
  },
  section: {
    gap: tokens.spacing[3],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spacing[3],
    rowGap: tokens.spacing[4],
  },
  cell: {
    flexBasis: '46%',
    flexGrow: 1,
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  postThumb: {
    width: 56,
    height: 56,
  },
  postText: {
    flex: 1,
    gap: 2,
  },
  cta: {
    gap: tokens.spacing[3],
    padding: tokens.spacing[5],
    borderRadius: tokens.radius.large,
    backgroundColor: colors.cobalt,
  },
}));
