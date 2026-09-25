import {
  CircleAlert,
  CircleCheck,
  Clock3,
  EyeOff,
  Flame,
  Gem,
  RotateCw,
  Share2,
  ShoppingBag,
  Sparkles,
  Users,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
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
  BottomBar,
  Button,
  ChoiceChips,
  CompanionOrb,
  CountUp,
  Field,
  IconButton,
  NavHeader,
  Photo,
  PriceRangeBar,
  Reveal,
  Screen,
  SelectField,
  Sheet,
  Sparkline,
  SWText,
  Surface,
  Tag,
  TextField,
  ZoomTarget,
  useToast,
} from '../../components';
import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import {
  formatPeso,
  previewConditions,
  previewItem,
  previewValuation,
  type PreviewCondition,
} from '../preview/sample-data';

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
  readonly onPostToFeed?: () => void;
  readonly onListForSale?: () => void;
  readonly onKeepPrivate?: () => void;
}

const conditionFactor = (key: PreviewCondition) =>
  previewConditions.find((condition) => condition.key === key)?.factor ?? 1;
/** The preview estimate is for a like-new item; other conditions scale from the good-condition base. */
const baseValue = previewItem.estimate / conditionFactor(previewValuation.condition);
const roundTo50 = (value: number) => Math.round(value / 50) * 50;

export function EstimateResultView({
  status = 'estimated',
  onBack,
  onShare,
  onRetry,
  onPostToFeed,
  onListForSale,
  onKeepPrivate,
}: EstimateResultViewProps) {
  const item = previewItem;
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [title, setTitle] = useState<string>(item.title);
  const [condition, setCondition] = useState<PreviewCondition>(previewValuation.condition);
  const [sharing, setSharing] = useState(false);
  const estimated = status === 'estimated';
  // Reveal only a newly resolved estimate; one opened from History is already known.
  const resolvedHere = useRef(!estimated);
  if (!estimated) resolvedHere.current = true;

  useEffect(() => {
    if (estimated && resolvedHere.current) haptic('success');
  }, [estimated]);

  const factor = conditionFactor(condition) / conditionFactor(previewValuation.condition);
  const value = roundTo50(baseValue * conditionFactor(condition));
  const low = roundTo50(previewValuation.low * factor);
  const high = roundTo50(previewValuation.high * factor);

  return (
    <Screen
      bleedTop
      header={
        <NavHeader
          title={estimated ? title : 'Estimating'}
          onBack={onBack}
          trailing={
            estimated ? (
              <IconButton
                icon={Share2}
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
            onListForSale={onListForSale}
            onPostToFeed={onPostToFeed}
            onKeepPrivate={onKeepPrivate}
          />
        ) : null
      }
      contentStyle={styles.content}
    >
      <View style={[styles.hero, { height: Math.round(height * (estimated ? 0.5 : 0.62)) }]}>
        <ZoomTarget>
          <Photo
            source={item.photo}
            label={item.photoLabel}
            radius={0}
            style={StyleSheet.absoluteFill}
          />
        </ZoomTarget>
        {status === 'estimating' ? <ScanOverlay /> : null}
      </View>

      <View style={styles.sheet}>
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
            <Reveal index={0} style={styles.headline}>
              <View style={styles.titleRow}>
                <SWText variant="caption" tone="textMuted">
                  {item.category}
                </SWText>
                <Tag label={`${previewValuation.confidence} confidence`} tone="accent" />
              </View>
              <View style={styles.estimateLabel}>
                <Sparkles size={14} strokeWidth={2.2} color={colors.accent} />
                <SWText variant="overline" tone="accent">
                  AI Estimate
                </SWText>
              </View>
              <CountUp
                variant="priceHero"
                value={value}
                format={formatPeso}
                durationMs={resolvedHere.current ? 1100 : 500}
                accessibilityLiveRegion="polite"
              />
              <SWText variant="bodyMedium" tone="textMuted">
                Likely {formatPeso(low)} – {formatPeso(high)} · AI estimate, not a sale price
              </SWText>
            </Reveal>

            <Reveal index={1}>
              <PriceRangeBar
                low={low}
                high={high}
                estimate={value}
                confidence={previewValuation.confidence}
                format={formatPeso}
              />
            </Reveal>

            <Reveal index={2} style={styles.insights}>
              <Insight
                icon={Flame}
                label={previewValuation.demand}
                detail={previewValuation.demandDetail}
              />
              <Insight
                icon={Clock3}
                label={previewValuation.sellTime}
                detail="Based on similar listings"
              />
              <Insight
                icon={Gem}
                label={previewValuation.rarity}
                detail="Fewer than 1 in 20 listings"
              />
            </Reveal>

            <Reveal index={3} style={styles.section}>
              <SectionTitle title="Condition" detail="Adjusts the estimate" />
              <ChoiceChips
                options={previewConditions.map(({ key, label }) => ({ key, label }))}
                value={condition}
                onChange={setCondition}
              />
              <Animated.View key={condition} entering={FadeIn.duration(220)}>
                <SWText variant="bodySmall" tone="textMuted">
                  {previewConditions.find((c) => c.key === condition)?.hint}
                </SWText>
              </Animated.View>
            </Reveal>

            <Reveal index={4} style={styles.section}>
              <SectionTitle
                title="Price trend"
                detail={previewValuation.trendChange}
                detailTone="success"
              />
              <Surface padding={tokens.spacing[4]}>
                <Sparkline values={previewValuation.trend} height={72} />
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
              <SectionTitle title="Recent sales" detail="Comparable items" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.bleed}
                contentContainerStyle={styles.comparables}
              >
                {previewValuation.comparables.map((comparable, index) => (
                  <Animated.View
                    key={comparable.id}
                    entering={FadeInDown.delay(360 + index * 70)
                      .springify()
                      .damping(18)}
                    style={styles.comparable}
                  >
                    <Photo
                      source={comparable.photo}
                      label={comparable.photoLabel}
                      aspectRatio={1}
                      radius={tokens.radius.medium}
                    />
                    <SWText variant="priceSmall">{formatPeso(comparable.price)}</SWText>
                    <SWText variant="caption" numberOfLines={1}>
                      {comparable.title}
                    </SWText>
                    <SWText variant="caption" tone="textMuted" numberOfLines={1}>
                      {comparable.soldAgo} · {comparable.source}
                    </SWText>
                  </Animated.View>
                ))}
              </ScrollView>
            </Reveal>

            <Reveal index={4} delay={200} style={styles.section}>
              <SectionTitle title="Details" />
              <Field label="Identified item">
                <TextField
                  value={title}
                  onChangeText={setTitle}
                  accessibilityLabel="Identified item"
                />
              </Field>
              <Field label="Category">
                <SelectField value={item.category} accessibilityLabel="Category" />
              </Field>
            </Reveal>
          </>
        ) : null}

        <SavedNote />
      </View>

      <ShareCardSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        title={title}
        value={value}
        low={low}
        high={high}
      />
    </Screen>
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
  readonly detail: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={styles.insight} accessible accessibilityLabel={`${label}. ${detail}`}>
      <Icon size={17} strokeWidth={2.1} color={colors.accent} />
      <SWText variant="labelSmall" numberOfLines={2}>
        {label}
      </SWText>
      <SWText variant="caption" tone="textMuted" numberOfLines={2}>
        {detail}
      </SWText>
    </View>
  );
}

function SavedNote() {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={styles.saved}>
      <CircleCheck size={15} strokeWidth={2} color={colors.success} />
      <SWText variant="labelMedium" tone="textSecondary">
        Photo saved to your history
      </SWText>
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
          <Animated.View
            key={label}
            entering={FadeInDown.springify().damping(16)}
            style={styles.detection}
          >
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
      <CompanionOrb size={44} mood="thinking" />
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
    <Animated.View entering={FadeInDown.springify().damping(18)}>
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

function Destinations({
  onListForSale,
  onPostToFeed,
  onKeepPrivate,
}: Pick<EstimateResultViewProps, 'onListForSale' | 'onPostToFeed' | 'onKeepPrivate'>) {
  const styles = useThemedStyles(stylesFor);
  return (
    <BottomBar>
      <Animated.View
        entering={FadeInDown.delay(500).springify().damping(18)}
        style={styles.destinations}
      >
        <IconButton
          icon={EyeOff}
          label="Keep private"
          appearance="tinted"
          onPress={onKeepPrivate}
        />
        <Button
          label="Ask the feed"
          variant="secondary"
          icon={Users}
          onPress={onPostToFeed}
          containerStyle={styles.flex}
        />
        <Button
          label="Sell"
          variant="accent"
          icon={ShoppingBag}
          accessibilityHint="Opens price confirmation. You set the asking price yourself."
          onPress={onListForSale}
          containerStyle={styles.flex}
        />
      </Animated.View>
    </BottomBar>
  );
}

/** The shareable valuation card (research: Vivino/StockX-style share cards). */
function ShareCardSheet({
  visible,
  onClose,
  title,
  value,
  low,
  high,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly value: number;
  readonly low: number;
  readonly high: number;
}) {
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();

  return (
    <Sheet visible={visible} onClose={onClose} title="Share valuation">
      <View style={styles.shareCard}>
        <Photo
          source={previewItem.photo}
          label={previewItem.photoLabel}
          aspectRatio={4 / 3}
          radius={tokens.radius.large}
        />
        <View style={styles.shareBody}>
          <SWText variant="headingMedium">{title}</SWText>
          <View style={styles.estimateLabel}>
            <SWText variant="overline" tone="accent">
              Worth about
            </SWText>
          </View>
          <SWText variant="priceLarge">{formatPeso(value)}</SWText>
          <SWText variant="caption" tone="textMuted">
            Range {formatPeso(low)} – {formatPeso(high)} · valued with SnapWorth
          </SWText>
        </View>
        <View style={styles.shareMark}>
          <CompanionOrb size={22} />
          <SWText variant="wordmark">SnapWorth</SWText>
        </View>
      </View>
      <Button
        label="Share card"
        icon={Share2}
        onPress={() => {
          void Share.share({ message: `${title} — worth about ${formatPeso(value)} on SnapWorth.` })
            .then((result) => {
              if (result.action === Share.sharedAction) toast.show({ title: 'Valuation shared' });
            })
            .catch(() => undefined);
          onClose();
        }}
      />
    </Sheet>
  );
}

const gutter = tokens.layout.pageGutterCompact;
const cornerSize = 26;

const stylesFor = themedStyles((colors, name) => ({
  content: {
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  hero: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.sunken,
  },
  sheet: {
    marginTop: -tokens.radius.xlarge,
    borderTopLeftRadius: tokens.radius.xlarge,
    borderTopRightRadius: tokens.radius.xlarge,
    backgroundColor: colors.canvas,
    paddingHorizontal: gutter,
    paddingTop: tokens.spacing[6],
    gap: tokens.spacing[8],
  },
  headline: {
    gap: tokens.spacing[1],
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
    gap: tokens.spacing[1],
  },
  insights: {
    flexDirection: 'row',
    gap: tokens.spacing[2],
  },
  insight: {
    flex: 1,
    gap: tokens.spacing[1],
    padding: tokens.spacing[3],
    borderRadius: tokens.radius.large,
    backgroundColor: colors.sunken,
  },
  section: {
    gap: tokens.spacing[3],
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
    gap: tokens.spacing[1],
  },
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    padding: tokens.spacing[2],
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
    backgroundColor: colors.accent,
    opacity: 0.18,
  },
  scanCore: {
    height: 2,
    backgroundColor: tokens.overlay.text,
    shadowColor: colors.accent,
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
  shareCard: {
    borderRadius: tokens.radius.xlarge,
    padding: tokens.spacing[3],
    gap: tokens.spacing[3],
    backgroundColor: colors.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    shadowColor: tokens.shadow[name],
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  shareBody: {
    gap: 2,
    paddingHorizontal: tokens.spacing[1],
  },
  shareMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[1],
    paddingBottom: tokens.spacing[1],
  },
}));
