import { MessageSquareOff, ShieldX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import {
  paperIn,
  BottomBar,
  Button,
  EmptyState,
  EstimateBadge,
  Field,
  hideWebFocusOutline,
  NavHeader,
  Photo,
  PriceTagIcon,
  Reveal,
  Screen,
  ScreenSkeleton,
  typeStyle,
  SWText,
  Tag,
  useToast,
} from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import type { MarketCategory, MarketListing } from '../../ports/marketplace';
import { useScanHistory } from '../history/scan-history-state';
import { useItemDetail, type ItemDetail } from '../item/item-source';
import { listingPhotoSource, useMarketplace } from '../marketplace/marketplace-state';
import { formatPeso } from '../preview/sample-data';
import { useFeed } from './feed-state';

/**
 * What moderation decided about a new post. `approved` goes live; `pending` is live once
 * checked; `held` waits for a human moderator; `blocked` is refused outright and never posted.
 */
export type PostModerationOutcome = 'approved' | 'pending' | 'held' | 'blocked';

export interface CreatePostViewProps {
  readonly itemId?: string;
  /** `listing` reposts a marketplace listing so the community can judge its asking price. */
  readonly source?: 'item' | 'listing';
  /** Optional moderation outcome override for preview/testing. */
  readonly outcome?: PostModerationOutcome;
  readonly onBack?: () => void;
  readonly onPublish?: (question: string, postId?: string) => void;
}

const maxLength = 280;

function inferCategory(title: string, fallback?: MarketCategory | null): MarketCategory {
  if (fallback) return fallback;
  const lower = title.toLowerCase();
  if (/jordan|sneaker|shoe|dunk/.test(lower)) return 'sneakers';
  if (/walkman|keyboard|keychron|sony|audio|headphone/.test(lower)) return 'electronics';
  if (/polaroid|camera|film|vintage|card|coin/.test(lower)) return 'collectibles';
  if (/lamp|chair|vase|table/.test(lower)) return 'home';
  return 'fashion';
}

/**
 * Asking the community about an estimate. The estimate travels with the post exactly as it was
 * given, so voters judge the AI's number, not a number the author edited. Publishing saves the
 * post to the feed repository and screens it, then hands off with a toast.
 */
export function CreatePostView(props: CreatePostViewProps) {
  const { itemId, source = 'item', onBack } = props;
  const lookup = useItemDetail(itemId);
  const { findListing, status } = useMarketplace();

  const foundItem = lookup.status === 'found' ? lookup.item : undefined;
  const foundListing = source === 'listing' ? (findListing(itemId) ?? undefined) : undefined;

  if (source === 'listing' ? foundListing : foundItem) {
    return <CreatePost {...props} foundItem={foundItem} foundListing={foundListing} />;
  }
  if (lookup.status === 'loading' || (source === 'listing' && status === 'loading')) {
    return <ScreenSkeleton kind="page" />;
  }
  return (
    <Screen ambient="feed" header={<NavHeader title="Ask the community" onBack={onBack} banded />}>
      <EmptyState
        icon={MessageSquareOff}
        title="Nothing to ask about"
        body={
          source === 'listing'
            ? 'This isn’t one of your listings. Open it from the Market to ask the community.'
            : 'This item isn’t one of your saved snaps. Open it from History to ask the community.'
        }
        actionLabel="Go back"
        onAction={onBack}
      />
    </Screen>
  );
}

function CreatePost({
  itemId,
  source = 'item',
  outcome,
  onBack,
  onPublish,
  foundItem,
  foundListing,
}: CreatePostViewProps & {
  readonly foundItem?: ItemDetail;
  readonly foundListing?: MarketListing;
}) {
  const { scans, ensurePhotoUploaded, reload: reloadScans } = useScanHistory();
  const { publishPost } = useFeed();

  const savedScan = itemId ? scans.find((entry) => entry.id === itemId) : undefined;

  const title = (source === 'listing' ? foundListing?.title : foundItem?.title) ?? '';
  // The AI estimate the post asks the community to judge: the listing's, or the scan's. A listing
  // made without a scan has none.
  const estimate =
    source === 'listing' ? (foundListing?.estimatePhp ?? null) : (foundItem?.estimate ?? null);
  const asking = source === 'listing' ? (foundListing?.askingPrice ?? null) : null;
  const photo =
    source === 'listing' && foundListing
      ? listingPhotoSource(foundListing)
      : (foundItem?.photos[0]?.source ?? null);
  const photoLabel =
    source === 'listing' && foundListing
      ? foundListing.photoLabel
      : (foundItem?.photos[0]?.label ?? title);

  const defaultQuestion =
    asking !== null
      ? `I'm asking ${formatPeso(asking)} for this ${title.toLowerCase()}. Fair price?`
      : estimate !== null
        ? `Is ${formatPeso(estimate)} right for this ${title.toLowerCase()}?`
        : `What's this ${title.toLowerCase()} worth?`;

  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const [question, setQuestion] = useState(defaultQuestion);
  const [editedQuestion, setEditedQuestion] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!editedQuestion) {
      setQuestion(defaultQuestion);
    }
  }, [defaultQuestion, editedQuestion]);

  const trimmed = question.trim();
  const canPost = trimmed.length > 0 && trimmed.length <= maxLength;

  const publish = async () => {
    if (!canPost || publishing) return;
    setPublishing(true);

    if (outcome === 'blocked') {
      setPublishing(false);
      setBlocked(true);
      return;
    }

    const uploadedPhotoPath = savedScan
      ? savedScan.photoPath && !savedScan.photoPending
        ? savedScan.photoPath
        : await ensurePhotoUploaded(savedScan.id)
      : null;

    const result = await publishPost({
      title,
      body: trimmed,
      estimate,
      category: inferCategory(title, foundListing?.category ?? null),
      scanId: savedScan?.id ?? foundListing?.scanId ?? null,
      listingId: source === 'listing' ? (foundListing?.rowId ?? foundListing?.id ?? itemId) : null,
      listingAskingPrice: asking,
      photoPath: uploadedPhotoPath ?? savedScan?.photoPath ?? foundListing?.photoPath ?? null,
      photoUrl: savedScan
        ? (savedScan.photoUrl ?? savedScan.photoUri)
        : (foundListing?.photoUrl ?? null),
    });
    setPublishing(false);

    if (!result.ok) {
      if (result.error.kind === 'validation' && result.error.code === 'blocked') {
        setBlocked(true);
        return;
      }
      toast.show({
        title: 'Couldn’t post to the feed',
        body:
          result.error.kind === 'rate_limited'
            ? 'You are posting too quickly. Try again in a while.'
            : 'Please check your connection and try again.',
        tone: 'error',
      });
      return;
    }

    if (savedScan) {
      void reloadScans();
    }

    const effectiveOutcome: PostModerationOutcome =
      outcome ??
      (result.value.moderationStatus === 'removed' ? 'blocked' : result.value.moderationStatus);

    if (effectiveOutcome === 'blocked') {
      setBlocked(true);
      return;
    }
    if (effectiveOutcome === 'held') {
      toast.show({
        title: 'Held for review',
        body: 'A moderator will check it before it appears on the feed.',
      });
    } else if (effectiveOutcome === 'pending') {
      toast.show({ title: 'Posted', body: 'Others will see it once it has been checked.' });
    } else {
      toast.show({ title: 'Posted to the feed', celebrate: true });
    }
    onPublish?.(trimmed, result.value.slug || result.value.id);
  };

  return (
    <Screen
      ambient="feed"
      header={<NavHeader title="Ask the community" onBack={onBack} banded />}
      footer={
        <BottomBar>
          <Button
            label="Post to feed"
            disabled={!canPost}
            loading={publishing}
            onPress={() => void publish()}
          />
          <SWText variant="caption" tone="textMuted" align="center">
            Posts are public.
          </SWText>
        </BottomBar>
      }
      contentStyle={styles.content}
    >
      <Reveal index={0} style={styles.lockup}>
        <Photo source={photo} label={photoLabel} aspectRatio={4 / 3} radius={tokens.radius.large} />
        <View style={styles.badges}>
          {estimate === null ? null : <EstimateBadge value={formatPeso(estimate)} />}
          {asking === null ? null : (
            <Tag label={`For sale · ${formatPeso(asking)}`} tone="mint" icon={PriceTagIcon} />
          )}
        </View>
      </Reveal>

      {blocked ? (
        <Animated.View
          entering={paperIn()}
          exiting={FadeOut.duration(tokens.motion.duration.fast)}
          style={styles.blocked}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <ShieldX size={18} strokeWidth={2} color={colors.danger} />
          <View style={styles.blockedText}>
            <SWText variant="label">Not posted</SWText>
            <SWText variant="bodySmall" tone="textSecondary">
              This breaks a community guideline. Edit your question and try again.
            </SWText>
          </View>
        </Animated.View>
      ) : null}

      <Reveal index={2}>
        <Field label="Your question" helper={`${trimmed.length}/${maxLength}`}>
          <TextInput
            value={question}
            onChangeText={(text) => {
              setEditedQuestion(true);
              setQuestion(text);
              setBlocked(false);
            }}
            multiline
            maxLength={maxLength}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accent}
            accessibilityLabel="Your question for the community"
            style={[
              styles.input,
              typeStyle('bodyLarge'),
              { color: colors.textPrimary, lineHeight: undefined },
              hideWebFocusOutline,
            ]}
          />
        </Field>
      </Reveal>
    </Screen>
  );
}

const stylesFor = themedStyles((colors) => ({
  content: {
    paddingTop: tokens.spacing[2],
    gap: tokens.spacing[6],
  },
  lockup: {
    gap: tokens.spacing[3],
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
  },
  blocked: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    padding: tokens.spacing[4],
    borderRadius: tokens.radius.medium,
    backgroundColor: colors.dangerSoft,
  },
  blockedText: {
    flex: 1,
    gap: tokens.spacing['0.5'],
  },
  input: {
    minHeight: tokens.spacing[16] + tokens.spacing[8],
    padding: tokens.spacing[4],
    borderRadius: tokens.radius.medium,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderStrong,
    backgroundColor: colors.sunken,
    textAlignVertical: 'top',
  },
}));
