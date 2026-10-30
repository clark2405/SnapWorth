import { Megaphone, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  Divider,
  EmptyState,
  Field,
  NavHeader,
  Photo,
  Reveal,
  Screen,
  Sheet,
  Surface,
  SWText,
  Tag,
  TextField,
  useToast,
  ZoomLink,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import type { HanapPost } from '../../ports/hanap';
import { relativeTime } from '../feed/comment-thread-model';
import { formatPeso } from '../preview/peso';
import { previewListings, type PreviewListing } from '../preview/sample-data';
import { useAccountGate } from '../session';
import { matchesHanap, parseBudget } from './hanap-match';
import { useHanap } from './hanap-state';

export interface HanapViewProps {
  readonly onBack?: () => void;
  readonly onOpenListing?: (listingId: string) => void;
  /** Opens the camera, for a seller who has what someone wants. */
  readonly onSnap?: () => void;
}

/** Listings that answer a hanap (Market's listings until they're stored in Supabase). */
export function hanapMatches(
  post: Pick<HanapPost, 'body' | 'maxPhp'>,
  listings: readonly PreviewListing[] = previewListings,
): readonly PreviewListing[] {
  return listings.filter((listing) => matchesHanap(post, listing));
}

/**
 * Hanap: what buyers are looking for. Your own posts show the listings that match them; everyone
 * else's tell sellers what people want, with a way to snap and list one. Anyone can look; posting
 * needs an account, and posts are moderated before others see them.
 */
export function HanapView({ onBack, onOpenListing, onSnap }: HanapViewProps) {
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const requireAccount = useAccountGate();
  const { status, mine, others, post, setFound, remove } = useHanap();
  const [posting, setPosting] = useState(false);

  return (
    <Screen
      ambient="market"
      header={<NavHeader title="Hanap" onBack={onBack} banded />}
      contentStyle={styles.content}
    >
      {/* A card, so the header's fade sits over paper rather than washing out the words. */}
      <Reveal index={0}>
        <Surface padding={tokens.spacing[4]} contentStyle={styles.intro}>
          <SWText variant="bodyMedium" tone="textSecondary">
            Tell sellers what you’re looking for. When a listing matches, it shows up here.
          </SWText>
          <Button
            label="Post a hanap"
            icon={Megaphone}
            onPress={() => requireAccount('hanap', () => setPosting(true))}
          />
        </Surface>
      </Reveal>

      {mine.length > 0 ? (
        <Reveal index={1} style={styles.section}>
          <SWText variant="headingMedium" accessibilityRole="header">
            Your hanap
          </SWText>
          {mine.map((entry) => (
            <OwnHanap
              key={entry.id}
              post={entry}
              onOpenListing={onOpenListing}
              onFound={async (found) => {
                const result = await setFound(entry.id, found);
                if (!result.ok) toast.show({ title: 'Couldn’t update it', body: 'Try again.' });
              }}
              onRemove={async () => {
                const result = await remove(entry.id);
                toast.show(
                  result.ok
                    ? { title: 'Hanap deleted' }
                    : { title: 'Couldn’t delete it', body: 'Try again.' },
                );
              }}
            />
          ))}
        </Reveal>
      ) : null}

      <Reveal index={2} style={styles.section}>
        <SWText variant="headingMedium" accessibilityRole="header">
          What people are looking for
        </SWText>
        {status === 'failed' ? (
          <EmptyState
            icon={Search}
            title="Couldn’t load what people want"
            body="Check your connection and try again."
          />
        ) : others.length === 0 && status === 'ready' ? (
          <EmptyState
            icon={Search}
            title="Nobody’s looking yet"
            body="Be the first: post what you’re hunting for."
          />
        ) : (
          others.map((entry) => (
            <Surface key={entry.id} padding={tokens.spacing[4]} contentStyle={styles.card}>
              <SWText variant="caption" tone="textMuted">
                {`@${entry.authorHandle} · ${relativeTime(entry.createdAt)}`}
              </SWText>
              <SWText variant="headingSmall">{entry.body}</SWText>
              <SWText variant="labelSmall" tone="textSecondary">
                {entry.maxPhp === null ? 'Any price' : `Up to ${formatPeso(entry.maxPhp)}`}
              </SWText>
              <View style={styles.cardActions}>
                <Button
                  label="I have one"
                  variant="secondary"
                  size="small"
                  onPress={() => requireAccount('snap', () => onSnap?.())}
                />
              </View>
            </Surface>
          ))
        )}
      </Reveal>

      <PostHanapSheet
        visible={posting}
        onClose={() => setPosting(false)}
        onPost={async (hanap) => {
          const result = await post(hanap);
          if (!result.ok) {
            toast.show(
              result.error.kind === 'rate_limited'
                ? { title: 'Slow down a little', body: 'You can post a few an hour.' }
                : { title: 'Couldn’t post it', body: 'Check it and try again.' },
            );
            return;
          }
          setPosting(false);
          toast.show(
            result.value.moderation === 'approved'
              ? { title: 'Posted', body: 'Matches will show up under Your hanap.' }
              : { title: 'Posted', body: 'Others will see it once it’s been checked.' },
          );
        }}
      />
    </Screen>
  );
}

const moderationTag: Partial<
  Record<HanapPost['moderation'], { label: string; tone: 'sand' | 'grave' }>
> = {
  pending: { label: 'Being checked', tone: 'sand' },
  held: { label: 'Held: only you can see it', tone: 'grave' },
  removed: { label: 'Removed', tone: 'grave' },
};

function OwnHanap({
  post,
  onOpenListing,
  onFound,
  onRemove,
}: {
  readonly post: HanapPost;
  readonly onOpenListing?: (listingId: string) => void;
  readonly onFound: (found: boolean) => void;
  readonly onRemove: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const matches = post.status === 'open' ? hanapMatches(post) : [];
  const moderation = moderationTag[post.moderation];

  return (
    <Surface padding={tokens.spacing[4]} contentStyle={styles.card}>
      <SWText variant="headingSmall">{post.body}</SWText>
      <View style={styles.tags}>
        <Tag
          label={post.maxPhp === null ? 'Any price' : `Up to ${formatPeso(post.maxPhp)}`}
          tone="sand"
        />
        {post.status === 'found' ? <Tag label="Found" tone="mint" /> : null}
        {moderation ? <Tag label={moderation.label} tone={moderation.tone} /> : null}
      </View>
      {post.status === 'open' ? (
        matches.length === 0 ? (
          <SWText variant="bodySmall" tone="textMuted">
            No matches yet. They’ll show up here.
          </SWText>
        ) : (
          <View>
            <SWText variant="labelSmall" tone="textSecondary">
              {matches.length === 1 ? '1 match' : `${matches.length} matches`}
            </SWText>
            {matches.map((listing, index) => (
              <View key={listing.id}>
                {index > 0 ? <Divider /> : null}
                <ZoomLink
                  href={`/listing/${listing.id}`}
                  label={`${listing.title}, asking ${formatPeso(listing.askingPrice)}`}
                  onPress={() => onOpenListing?.(listing.id)}
                  style={styles.match}
                >
                  <Photo
                    source={listing.photo}
                    label={listing.photoLabel}
                    radius={tokens.radius.small}
                    style={styles.thumb}
                  />
                  <View style={styles.matchText}>
                    <SWText variant="label" numberOfLines={1}>
                      {listing.title}
                    </SWText>
                    <SWText variant="caption" tone="textSecondary">
                      Asking {formatPeso(listing.askingPrice)}
                    </SWText>
                  </View>
                </ZoomLink>
              </View>
            ))}
          </View>
        )
      ) : null}
      <View style={styles.cardActions}>
        <Button
          label={post.status === 'open' ? 'Found it' : 'Still looking'}
          variant="tertiary"
          size="small"
          onPress={() => onFound(post.status === 'open')}
        />
        <Button label="Delete" variant="tertiary" size="small" onPress={onRemove} />
      </View>
    </Surface>
  );
}

function PostHanapSheet({
  visible,
  onClose,
  onPost,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onPost: (hanap: { body: string; maxPhp: number | null }) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const [budget, setBudget] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setBody('');
    setBudget('');
  }, [visible]);

  const text = body.replace(/\s+/g, ' ').trim();
  const maxPhp = parseBudget(budget);
  const ready = text.length >= 3 && (budget.trim() === '' || maxPhp !== null);

  return (
    <Sheet visible={visible} onClose={onClose} title="Post a hanap">
      <Field label="What are you looking for?" helper="Say what it is, and the size if it matters.">
        <TextField
          value={body}
          onChangeText={setBody}
          placeholder="e.g. Nike windbreaker, size M"
          maxLength={140}
          accessibilityLabel="What you’re looking for"
          autoFocus
        />
      </Field>
      <Field label="Most you’ll pay" helper="Leave it empty for any price.">
        <TextField
          prefix="₱"
          value={budget}
          onChangeText={setBudget}
          placeholder="1500"
          keyboardType="number-pad"
          inputMode="numeric"
          accessibilityLabel="Most you’ll pay, in pesos"
        />
      </Field>
      <Button
        label={sending ? 'Posting…' : 'Post'}
        haptic="pop"
        disabled={!ready || sending}
        onPress={async () => {
          setSending(true);
          await onPost({ body: text, maxPhp: budget.trim() === '' ? null : maxPhp });
          setSending(false);
        }}
      />
    </Sheet>
  );
}

const stylesFor = themedStyles(() => ({
  // Room under the header, whose fade would otherwise cover the first line.
  content: {
    gap: tokens.spacing[6],
    paddingTop: tokens.spacing[4],
  },
  intro: {
    gap: tokens.spacing[3],
  },
  section: {
    gap: tokens.spacing[3],
  },
  card: {
    gap: tokens.spacing[2],
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[1],
  },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
  },
  thumb: {
    width: 44,
    height: 44,
  },
  matchText: {
    flex: 1,
    gap: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: tokens.spacing[2],
  },
}));
