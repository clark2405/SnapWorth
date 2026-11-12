import {
  CircleAlert,
  CircleCheck,
  Clock3,
  EyeOff,
  Flame,
  Gem,
  Handshake,
  Lock,
  PackageSearch,
  RotateCw,
  ShoppingBag,
  type LucideIcon,
  Users,
  WifiOff,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  paperIn,
  BottomBar,
  Button,
  ChoiceChips,
  CountUp,
  DetailHero,
  DetailLayout,
  DetailSheet,
  EmptyState,
  Field,
  IconButton,
  NavHeader,
  Photo,
  PriceRangeBar,
  PriceTagIcon,
  Reveal,
  Screen,
  ScreenSkeleton,
  SelectField,
  shareIcon,
  Sparkline,
  Stamp,
  Surface,
  SWText,
  Tag,
  TagShape,
  TextField,
  Worthy,
  WorthySays,
} from '../../components';
import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import { formatPeso } from '../preview/peso';
import type { PreviewCondition } from '../preview/sample-data';
import { PaidPriceSection } from '../history/PaidPriceSection';
import { ShareTagSheet } from '../history/ShareTagSheet';
import { Tip, useTip } from '../tips';
import {
  useItemDetail,
  type ItemDetail,
  type ItemPlacement,
  type SampleValuation,
} from './item-source';

/**
 * Where the estimate stands. The photo is already saved in every state, because the item is
 * persisted before the estimate is requested (SDD §5).
 */
export type EstimateStatus = 'estimating' | 'estimated' | 'failed' | 'offline';

export interface EstimateResultViewProps {
  readonly itemId?: string;
  readonly status?: EstimateStatus;
  readonly onBack?: () => void;
  readonly onShare?: () => void;
  readonly onRetry?: () => void;
  /** `listing` when the item is already for sale, so the post asks about its asking price. */
  readonly onPostToFeed?: (source: 'item' | 'listing') => void;
  readonly onListForSale?: () => void;
  readonly onKeepPrivate?: () => void;
  /** Opens the feed post this item is already shared in. */
  readonly onViewPost?: (postId: string) => void;
  /** Opens the marketplace listing for this item. */
  readonly onViewListing?: (listingId: string) => void;
  /**
   * `sheet` is the answer to a fresh snap, risen over the frozen camera the way Visual
   * Intelligence answers: the photo is already behind it, so the price leads, and the sheet is
   * swiped away rather than backed out of. `screen` is an item opened from History.
   */
  readonly presentation?: 'screen' | 'sheet';
}

const roundTo50 = (value: number) => Math.round(value / 50) * 50;

/** Whether a photo's source points at something: anything but a link that is missing or blank. */
function hasImage(photo: ItemDetail['photos'][number]): boolean {
  const source = photo.source;
  if (Array.isArray(source)) return source.length > 0;
  if (typeof source === 'object' && source !== null && 'uri' in source) {
    return typeof source.uri === 'string' && source.uri.trim() !== '';
  }
  return true;
}

const conditionFactor = (sample: SampleValuation, key: PreviewCondition) =>
  sample.conditions.find((condition) => condition.key === key)?.factor ?? 1;

/**
 * The sample's price at a condition. Its estimate is for the condition the AI saw; other
 * conditions scale from there.
 */
function sampleAt(item: ItemDetail, sample: SampleValuation, condition: PreviewCondition) {
  const seen = conditionFactor(sample, sample.valuation.condition);
  const factor = conditionFactor(sample, condition) / seen;
  return {
    value: roundTo50((item.estimate / seen) * conditionFactor(sample, condition)),
    low: roundTo50(item.low * factor),
    high: roundTo50(item.high * factor),
  };
}

/**
 * Worthy's word on the condition chosen, in pesos: what it adds or costs against like new, and
 * what to do about it. `low` is the bottom of the range at that condition.
 */
function conditionLine(
  item: ItemDetail,
  sample: SampleValuation,
  condition: PreviewCondition,
  low: number,
): string {
  const worth = (key: PreviewCondition) => sampleAt(item, sample, key).value;
  const gap = formatPeso(Math.abs(worth('like_new') - worth(condition)));
  switch (condition) {
    case 'new':
      return `Tags still on? Say so first. New is worth ${gap} more than like new.`;
    case 'like_new':
      return 'Like new is where this sells best. Photograph the label and any wear up close: buyers pay for proof.';
    case 'good':
      return `Good knocks about ${gap} off like new. A wash and a daylight photo can win some back.`;
    case 'fair':
      return `Fair still sells, just slower. Ask near ${formatPeso(low)} to move it this month.`;
  }
}

/**
 * One thing in History: a saved scan, with the AI's estimate, range and reasoning, or the sample
 * preview before the first scan. An id that's neither is answered with a page saying so.
 */
export function EstimateResultView(props: EstimateResultViewProps) {
  const lookup = useItemDetail(props.itemId);
  if (lookup.status === 'loading') return <ScreenSkeleton kind="detail" />;
  if (lookup.status === 'missing') return <MissingItem onBack={props.onBack} />;
  // A different item starts afresh: its own title, condition and reveal.
  return <ItemResult key={lookup.item.id} {...props} item={lookup.item} />;
}

function MissingItem({ onBack }: { readonly onBack?: () => void }) {
  return (
    <Screen ambient="history" header={<NavHeader title="Item" onBack={onBack} banded />}>
      <EmptyState
        icon={PackageSearch}
        title="This item isn’t in your History"
        body="It may have been deleted, or saved by another account. Your other things are still in History."
        actionLabel={onBack ? 'Back to History' : undefined}
        onAction={onBack}
      />
    </Screen>
  );
}

function ItemResult({
  item,
  status = 'estimated',
  onBack,
  onShare,
  onRetry,
  onPostToFeed,
  onListForSale,
  onKeepPrivate,
  onViewPost,
  onViewListing,
  presentation = 'screen',
}: EstimateResultViewProps & { readonly item: ItemDetail }) {
  const asSheet = presentation === 'sheet';
  const listTip = useTip('list');
  const sample = item.sample;
  // A fresh capture (the sheet) is private until the owner shares it; History items carry their
  // own state. The preview reuses a History item for the capture, so the sheet ignores its state.
  const placement: ItemPlacement = asSheet ? {} : item.placement;
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  // Only the sample's name can be edited, as a preview; a scan keeps the name the AI gave it.
  const [title, setTitle] = useState<string>(item.title);
  const [condition, setCondition] = useState<PreviewCondition>(
    sample?.valuation.condition ?? 'like_new',
  );
  const [sharing, setSharing] = useState(false);
  const estimated = status === 'estimated';
  // Reveal only a newly resolved estimate; one opened from History is already known.
  const resolvedHere = useRef(!estimated);
  if (!estimated) resolvedHere.current = true;

  useEffect(() => {
    if (estimated && resolvedHere.current) haptic('success');
  }, [estimated]);

  const { value, low, high } = sample
    ? sampleAt(item, sample, condition)
    : { value: item.estimate, low: item.low, high: item.high };
  // A scan saved without a usable photo has none to show, and doesn't claim one was kept.
  const photos = item.photos.filter(hasImage);
  const cover = photos[0];
  // "Ready to sell?" is for an item that is still only a scan: not once it is for sale or sold.
  const alreadyForSale =
    placement.listed === true || placement.sold === true || placement.listingId !== undefined;

  return (
    <Screen
      ambient="history"
      bleedTop={!asSheet}
      width="split"
      sheet={asSheet}
      header={
        // In the sheet the title stays up from the start: the photo is behind the sheet, so the
        // name is what tells you what was recognised.
        <NavHeader
          title={estimated ? title : asSheet ? 'New snap' : 'Estimating'}
          banded={asSheet}
          onBack={asSheet ? undefined : onBack}
          trailing={
            estimated ? (
              <IconButton
                icon={shareIcon}
                label="Share this estimate"
                appearance="glass"
                onPress={() => {
                  setSharing(true);
                  onShare?.();
                }}
              />
            ) : null
          }
        />
      }
      footer={
        estimated ? (
          <Destinations
            sharing={placement}
            onListForSale={() => {
              listTip.done();
              onListForSale?.();
            }}
            onPostToFeed={(source) => {
              listTip.done();
              onPostToFeed?.(source);
            }}
            onKeepPrivate={onKeepPrivate}
            onViewPost={onViewPost}
            onViewListing={onViewListing}
          />
        ) : null
      }
      contentStyle={styles.content}
    >
      <DetailLayout
        hero={
          asSheet ? null : (
            <DetailHero photos={photos} heightRatio={estimated ? 0.5 : 0.62}>
              {status === 'estimating' ? <ScanOverlay /> : null}
            </DetailHero>
          )
        }
      >
        {/* Only an estimate that resolves here gets the reveal; one opened from History is known. */}
        <DetailSheet
          reveal={resolvedHere.current}
          style={[styles.sheet, asSheet ? styles.inSheet : null]}
        >
          {status === 'estimating' ? <EstimatingStatus /> : null}
          {status === 'failed' ? (
            <Problem
              icon={CircleAlert}
              title="We couldn’t estimate this item."
              body="Your photo is saved in History. Try again, or come back to it later."
              onRetry={onRetry}
            />
          ) : null}
          {status === 'offline' ? (
            <Problem
              icon={WifiOff}
              title="You’re offline."
              body="Your photo is saved. Reconnect and try again to get the estimate."
              onRetry={onRetry}
            />
          ) : null}

          {estimated ? (
            <>
              {/* The appraisal hangs on its price tag, stamped with how sure the AI is. */}
              <Reveal index={0} style={styles.headline}>
                <SWText variant="caption" tone="textMuted">
                  {item.category ?? (item.capturedOn ? `Snapped ${item.capturedOn}` : '')}
                </SWText>
                <View style={styles.tagRow}>
                  <TagShape
                    hanging
                    tilt={tokens.tilt.start}
                    swing={resolvedHere.current}
                    style={styles.priceTag}
                  >
                    <SWText variant="stamp" color={colors.kraftInk}>
                      AI Estimate
                    </SWText>
                    <CountUp
                      variant="priceHero"
                      color={colors.kraftInk}
                      value={value}
                      format={formatPeso}
                      from={resolvedHere.current ? undefined : value}
                      durationMs={1100}
                      accessibilityLiveRegion="polite"
                    />
                  </TagShape>
                  {item.confidence ? (
                    <Stamp
                      label={`${item.confidence} confidence`}
                      side="end"
                      // Stamped once the count has landed on the price.
                      land={resolvedHere.current ? { delay: 1250 } : undefined}
                      style={styles.confidence}
                    />
                  ) : null}
                </View>
                <SWText variant="bodyMedium" tone="textMuted">
                  AI estimate, not a sale price
                </SWText>
              </Reveal>

              <Reveal index={1}>
                <PriceRangeBar
                  low={low}
                  high={high}
                  estimate={value}
                  confidence={item.confidence ?? 'medium'}
                  format={formatPeso}
                  showConfidence={false}
                  animate={resolvedHere.current}
                />
              </Reveal>

              {item.explanation ? (
                <Reveal index={2} style={styles.section}>
                  <SectionTitle title="Why this price" />
                  <SWText variant="bodyMedium" tone="textSecondary">
                    {item.explanation}
                  </SWText>
                  {item.assumptions.length > 0 ? (
                    <View style={styles.assumptions} accessibilityRole="list">
                      <SWText variant="labelMedium" tone="textMuted">
                        What the AI assumed
                      </SWText>
                      {item.assumptions.map((assumption) => (
                        <SWText key={assumption} variant="bodySmall" tone="textSecondary">
                          {`• ${assumption}`}
                        </SWText>
                      ))}
                    </View>
                  ) : null}
                </Reveal>
              ) : null}

              <Reveal index={2} style={styles.section}>
                <PaidPriceSection itemId={item.id} worth={value} />
              </Reveal>

              {alreadyForSale ? null : <Tip id="list" />}

              {sample ? (
                <SampleMarket
                  item={item}
                  sample={sample}
                  condition={condition}
                  onCondition={setCondition}
                  low={low}
                  title={title}
                  onTitle={setTitle}
                />
              ) : null}
            </>
          ) : null}

          <SavedNote sharing={placement} hasPhoto={photos.length > 0} />
        </DetailSheet>
      </DetailLayout>

      <ShareTagSheet
        item={
          sharing && cover
            ? {
                id: item.id,
                title,
                photo: cover.source,
                photoLabel: cover.label,
                worth: value,
              }
            : null
        }
        onClose={() => setSharing(false)}
      />
    </Screen>
  );
}

/**
 * The sample's market detail: demand, how condition moves the price, the trend and recent sales.
 * A real scan doesn't have these yet, so it shows the AI's estimate and reasoning alone.
 */
function SampleMarket({
  item,
  sample,
  condition,
  onCondition,
  low,
  title,
  onTitle,
}: {
  readonly item: ItemDetail;
  readonly sample: SampleValuation;
  readonly condition: PreviewCondition;
  readonly onCondition: (condition: PreviewCondition) => void;
  readonly low: number;
  readonly title: string;
  readonly onTitle: (title: string) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const { valuation, conditions } = sample;
  return (
    <>
      <Reveal index={2} style={styles.insights}>
        <Insight icon={Flame} label={valuation.demand} detail={valuation.demandDetail} />
        <Insight icon={Clock3} label={valuation.sellTime} />
        <Insight icon={Gem} label={valuation.rarity} detail="Fewer than 1 in 20 listings" />
      </Reveal>

      <Reveal index={3} style={styles.section}>
        <SectionTitle title="Condition" />
        <ChoiceChips
          options={conditions.map(({ key, label }) => ({ key, label }))}
          value={condition}
          onChange={onCondition}
        />
        <Animated.View key={condition} entering={FadeIn.duration(220)}>
          <SWText variant="bodySmall" tone="textMuted">
            {conditions.find((c) => c.key === condition)?.hint}
          </SWText>
        </Animated.View>
      </Reveal>

      <Reveal index={3} delay={80}>
        <Animated.View key={condition} entering={FadeIn.duration(220)}>
          <WorthySays>{conditionLine(item, sample, condition, low)}</WorthySays>
        </Animated.View>
      </Reveal>

      <Reveal index={4} style={styles.section}>
        <SectionTitle title="Price trend" detail={valuation.trendChange} detailTone="success" />
        <Surface padding={tokens.spacing[4]}>
          <Sparkline values={valuation.trend} height={72} />
          <View style={styles.trendAxis}>
            <SWText variant="caption" tone="textMuted">
              12 weeks ago
            </SWText>
            <SWText variant="caption" tone="textMuted">
              Today
            </SWText>
          </View>
        </Surface>
      </Reveal>

      <Reveal index={4} delay={120} style={styles.section}>
        <SectionTitle title="Recent sales" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bleed}
          contentContainerStyle={styles.comparables}
        >
          {valuation.comparables.map((comparable, index) => (
            <Animated.View
              key={comparable.id}
              entering={paperIn(360 + index * 70)}
              style={styles.comparable}
            >
              <Photo
                source={comparable.photo}
                label={comparable.photoLabel}
                aspectRatio={1}
                radius={tokens.radius.medium}
              />
              <SWText variant="priceSmall">{formatPeso(comparable.price)}</SWText>
              <SWText variant="caption" numberOfLines={2} style={styles.comparableTitle}>
                {comparable.title}
              </SWText>
              <SWText variant="caption" tone="textMuted" numberOfLines={1}>
                {comparable.soldAgo}
              </SWText>
              <SWText variant="caption" tone="textMuted" numberOfLines={1}>
                {comparable.source}
              </SWText>
            </Animated.View>
          ))}
        </ScrollView>
      </Reveal>

      <Reveal index={4} delay={200} style={styles.section}>
        <SectionTitle title="Details" />
        <Field label="Identified item">
          <TextField value={title} onChangeText={onTitle} accessibilityLabel="Identified item" />
        </Field>
        <Field label="Category">
          <SelectField value={item.category ?? ''} accessibilityLabel="Category" />
        </Field>
      </Reveal>
    </>
  );
}

function SectionTitle({
  title,
  detail,
  detailTone = 'textMuted',
}: {
  readonly title: string;
  readonly detail?: string;
  readonly detailTone?: 'textMuted' | 'success';
}) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={styles.sectionTitle}>
      <SWText variant="headingMedium" accessibilityRole="header">
        {title}
      </SWText>
      {detail ? (
        <SWText variant="labelMedium" tone={detailTone}>
          {detail}
        </SWText>
      ) : null}
    </View>
  );
}

function Insight({
  icon: Icon,
  label,
  detail,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly detail?: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  return (
    <View
      style={styles.insight}
      accessible
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
    >
      <Icon size={22} strokeWidth={1.5} color={colors.textPrimary} />
      <View style={styles.insightText}>
        <SWText variant="headingSmall">{label}</SWText>
        {detail ? (
          <SWText variant="bodySmall" tone="textMuted">
            {detail}
          </SWText>
        ) : null}
      </View>
    </View>
  );
}

/** Saved to history always; then wherever else the item lives. */
function SavedNote({
  sharing,
  hasPhoto,
}: {
  readonly sharing: ItemPlacement;
  readonly hasPhoto: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const onFeed = sharing.onFeed || sharing.postId !== undefined;
  const forSale = sharing.listed || sharing.sold || sharing.listingId !== undefined;
  return (
    <View style={styles.saved}>
      <View style={styles.savedLine}>
        <CircleCheck size={15} strokeWidth={2} color={colors.success} />
        <SWText variant="labelMedium" tone="textSecondary">
          {hasPhoto ? 'Photo saved to your history' : 'Saved to your history'}
        </SWText>
      </View>
      <View style={styles.sharedTags}>
        {onFeed || forSale ? null : <Tag label="Private" tone="sand" icon={Lock} />}
        {onFeed ? <Tag label="On feed" tone="sand" icon={Users} /> : null}
        {forSale ? (
          sharing.sold ? (
            <Tag label="Sold" tone="grave" icon={Handshake} />
          ) : (
            <Tag label="Listed" tone="mint" icon={PriceTagIcon} />
          )
        ) : null}
      </View>
    </View>
  );
}

const detections = ['Nike', 'Windbreaker', 'Early 1990s', 'Teal / purple'];

/**
 * While the estimate is unresolved the photo is visibly being read: a line of light sweeps the
 * frame, the corners breathe, and what the model recognises appears as it is found. It is the
 * one repeating motion SnapWorth allows; reduced motion keeps the chips and drops the sweep.
 */
function ScanOverlay() {
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const [frameHeight, setFrameHeight] = useState(0);
  const [found, setFound] = useState(0);
  const sweep = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || frameHeight === 0) return;
    sweep.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: tokens.motion.recipe.estimateWait.durationMs,
          easing: Easing.inOut(Easing.cubic),
        }),
        withDelay(tokens.motion.recipe.estimateWait.restMs, withTiming(0, { duration: 0 })),
      ),
      -1,
    );
    breathe.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(sweep);
      cancelAnimation(breathe);
    };
  }, [breathe, frameHeight, reduceMotion, sweep]);

  useEffect(() => {
    const timers = detections.map((_, index) =>
      setTimeout(
        () => {
          setFound(index + 1);
          haptic('select');
        },
        500 + index * 600,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sweep.value * frameHeight }],
    opacity: sweep.value < 0.04 || sweep.value > 0.96 ? 0 : 1,
  }));
  const cornerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - breathe.value * 0.04 }],
  }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setFrameHeight(event.nativeEvent.layout.height)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[StyleSheet.absoluteFill, styles.scanDim]} />
      <Animated.View style={[styles.scanFrame, cornerStyle]}>
        {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map((corner) => (
          <View key={corner} style={[styles.corner, styles[corner]]} />
        ))}
      </Animated.View>
      {reduceMotion ? null : (
        <Animated.View style={[styles.scanLine, lineStyle]}>
          <View style={styles.scanGlow} />
          <View style={styles.scanCore} />
        </Animated.View>
      )}
      <View style={styles.detections}>
        {detections.slice(0, found).map((label) => (
          <Animated.View key={label} entering={paperIn()} style={styles.detection}>
            <SWText variant="labelSmall" color={tokens.overlay.text}>
              {label}
            </SWText>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

/**
 * Status text appears only after the two-second threshold, so fast estimates never flash a
 * loading message. It never shows a percentage: the wait has no truthful progress to report.
 */
function EstimatingStatus() {
  const styles = useThemedStyles(stylesFor);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), tokens.motion.duration.estimateProgressDelay);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      <Worthy size={44} mood="thinking" />
      <View style={styles.flex}>
        {visible ? (
          <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut}>
            <SWText variant="headingMedium">Estimating value…</SWText>
            <SWText variant="bodySmall" tone="textMuted">
              Comparing with recent sales. This usually takes a few seconds.
            </SWText>
          </Animated.View>
        ) : (
          <SWText variant="headingMedium">Reading your photo</SWText>
        )}
      </View>
    </View>
  );
}

function Problem({
  icon: Icon,
  title,
  body,
  onRetry,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  return (
    <Animated.View entering={paperIn()}>
      <Surface padding={tokens.spacing[5]} contentStyle={styles.problem}>
        <View style={styles.problemHeader} accessibilityLiveRegion="assertive">
          <Icon size={20} strokeWidth={2} color={colors.danger} />
          <SWText variant="headingMedium" style={styles.flex}>
            {title}
          </SWText>
        </View>
        <SWText variant="bodyMedium" tone="textSecondary">
          {body}
        </SWText>
        <Button label="Try again" icon={RotateCw} onPress={onRetry} />
      </Surface>
    </Animated.View>
  );
}

/**
 * The ways forward from an estimate. Sharing is never either/or: an item on the feed can be
 * listed too, and a listing can go to the feed to ask whether its price is fair.
 */
function Destinations({
  sharing,
  onListForSale,
  onPostToFeed,
  onKeepPrivate,
  onViewPost,
  onViewListing,
}: { readonly sharing: ItemPlacement } & Pick<
  EstimateResultViewProps,
  'onListForSale' | 'onPostToFeed' | 'onKeepPrivate' | 'onViewPost' | 'onViewListing'
>) {
  const styles = useThemedStyles(stylesFor);
  const { postId, listingId, sold } = sharing;

  const feedAction = postId ? (
    <Button
      label="View post"
      variant="secondary"
      icon={Users}
      onPress={() => onViewPost?.(postId)}
      containerStyle={styles.flex}
    />
  ) : (
    <Button
      label="Ask the feed"
      variant={listingId && !sold ? 'accent' : 'secondary'}
      icon={Users}
      accessibilityHint={
        listingId ? 'Reposts your listing so the community can vote on its price.' : undefined
      }
      onPress={() => onPostToFeed?.(listingId && !sold ? 'listing' : 'item')}
      containerStyle={styles.flex}
    />
  );

  const marketAction = listingId ? (
    <Button
      label={sold ? 'View sale' : 'View listing'}
      variant="secondary"
      icon={sold ? Handshake : PriceTagIcon}
      onPress={() => onViewListing?.(listingId)}
      containerStyle={styles.flex}
    />
  ) : (
    <Button
      label={postId ? 'Sell it too' : 'Sell'}
      variant="accent"
      icon={ShoppingBag}
      accessibilityHint="Opens price confirmation. You set the asking price yourself."
      onPress={onListForSale}
      containerStyle={postId ? styles.flex : undefined}
    />
  );

  return (
    <BottomBar>
      {/* The actions arrive with their bar, not after it. */}
      <View style={styles.destinations}>
        {postId || listingId ? null : (
          <IconButton
            icon={EyeOff}
            label="Keep private"
            appearance="tinted"
            onPress={onKeepPrivate}
          />
        )}
        {feedAction}
        {marketAction}
      </View>
    </BottomBar>
  );
}

const gutter = tokens.layout.pageGutterCompact;
const cornerSize = 26;

const stylesFor = themedStyles((colors) => ({
  content: {
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  // The sheet is already the page's surface, so the body sits flat on it rather than as a
  // second rounded card.
  inSheet: {
    marginTop: 0,
    paddingTop: tokens.spacing[5],
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: 'transparent',
  },
  sheet: {
    gap: tokens.spacing[10],
  },
  headline: {
    gap: tokens.spacing[3],
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: tokens.spacing[3],
    paddingTop: tokens.spacing[5],
  },
  priceTag: {
    paddingRight: tokens.spacing[6],
    paddingVertical: tokens.spacing[4],
    gap: tokens.spacing[1],
  },
  confidence: {
    marginBottom: tokens.spacing[2],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing[2],
  },
  estimateLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  // Highlights read as a quiet list, icon then title over one line of context, the way
  // listing highlights do on the big marketplaces, rather than three cramped tiles.
  insights: {
    gap: tokens.spacing[5],
    paddingVertical: tokens.spacing[6],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing[4],
  },
  insightText: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: tokens.spacing[3],
  },
  assumptions: {
    gap: tokens.spacing[1],
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  trendAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: tokens.spacing[2],
  },
  bleed: {
    marginHorizontal: -gutter,
  },
  comparables: {
    gap: tokens.spacing[3],
    paddingHorizontal: gutter,
  },
  comparable: {
    width: 148,
    gap: 2,
  },
  // Two lines reserved for every title, so the cards in the row stay the same height.
  comparableTitle: {
    minHeight: tokens.typography.style.caption.lineHeight * 2,
    marginTop: tokens.spacing[1],
  },
  // On the content's left edge like everything above it, with where the item lives at the end.
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: tokens.spacing[3],
  },
  savedLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  sharedTags: {
    flexDirection: 'row',
    gap: tokens.spacing[2],
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[4],
    minHeight: 64,
  },
  flex: {
    flex: 1,
  },
  problem: {
    gap: tokens.spacing[3],
  },
  problemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  destinations: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  scanDim: {
    backgroundColor: tokens.overlay.chrome,
    opacity: 0.35,
  },
  scanFrame: {
    position: 'absolute',
    top: '16%',
    bottom: '22%',
    left: '12%',
    right: '12%',
  },
  corner: {
    position: 'absolute',
    width: cornerSize,
    height: cornerSize,
    borderColor: tokens.overlay.text,
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: 'absolute',
    top: -20,
    left: 0,
    right: 0,
    height: 40,
    justifyContent: 'center',
  },
  scanGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.sand,
    opacity: 0.35,
  },
  scanCore: {
    height: 2,
    backgroundColor: tokens.overlay.text,
    shadowColor: tokens.overlay.text,
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  detections: {
    position: 'absolute',
    left: gutter,
    right: gutter,
    bottom: tokens.radius.xlarge + tokens.spacing[4],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
  },
  detection: {
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[1] + 2,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.overlay.chrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.overlay.border,
  },
}));
