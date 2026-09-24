import {
  CircleAlert,
  CircleCheck,
  EyeOff,
  RotateCw,
  Share2,
  ShoppingBag,
  Users,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import {
  BottomBar,
  Button,
  EstimateBadge,
  Field,
  IconButton,
  NavHeader,
  Photo,
  Reveal,
  Screen,
  SelectField,
  Surface,
  SWText,
  TextField,
} from '../../components';
import { tokens, useMotionPreference } from '../../design';
import { formatPeso, previewItem } from '../preview/sample-data';

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

const useNativeDriver = Platform.OS !== 'web';
const revealCurve = tokens.motion.bezier.expressive;
const revealEasing = Easing.bezier(
  revealCurve[0] ?? 0,
  revealCurve[1] ?? 0,
  revealCurve[2] ?? 1,
  revealCurve[3] ?? 1,
);

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
  const [title, setTitle] = useState<string>(item.title);
  const estimated = status === 'estimated';
  // Reveal only a newly resolved estimate; one opened from History is already known.
  const resolvedHere = useRef(!estimated);
  if (!estimated) resolvedHere.current = true;

  return (
    <Screen
      header={
        <NavHeader
          title="Estimate"
          onBack={onBack}
          trailing={
            estimated ? (
              <IconButton icon={Share2} label="Share this estimate" onPress={onShare} />
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
      <Reveal index={0} style={styles.lockup}>
        <View>
          <Photo
            source={item.photo}
            label={item.photoLabel}
            aspectRatio={4 / 3}
            radius={tokens.radius.large}
          />
          {status === 'estimating' ? <WaitCue /> : null}
        </View>

        {status === 'estimating' ? <EstimatingStatus /> : null}
        {estimated ? (
          <RevealedEstimate value={formatPeso(item.estimate)} animate={resolvedHere.current} />
        ) : null}
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

        <View style={styles.saved}>
          <CircleCheck size={16} strokeWidth={2} color={tokens.color.dark.voteRight} />
          <SWText variant="labelMedium" tone="textSecondary">
            Photo saved to your history
          </SWText>
        </View>
      </Reveal>

      {estimated ? (
        <Reveal index={1} style={styles.fields}>
          <Field label="Identified item">
            <TextField value={title} onChangeText={setTitle} accessibilityLabel="Identified item" />
          </Field>
          <Field label="Category">
            <SelectField value={item.category} accessibilityLabel="Category" />
          </Field>
        </Reveal>
      ) : null}
    </Screen>
  );
}

/**
 * Status text appears only after the two-second threshold, so fast estimates never flash a
 * loading message. It never shows a percentage: the wait has no truthful progress to report.
 */
function EstimatingStatus() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), tokens.motion.duration.estimateProgressDelay);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      <SWText variant="headingMedium" tone={visible ? 'textPrimary' : 'canvas'}>
        {visible ? 'Estimating value…' : ' '}
      </SWText>
      <SWText variant="bodySmall" tone="textMuted">
        {visible ? 'This usually takes a few seconds.' : ' '}
      </SWText>
    </View>
  );
}

/**
 * A thin sweep along the photo's lower edge while the estimate is unresolved. It is the one
 * repeating motion SnapWorth allows, it stays inside the photo frame, and it stops the moment
 * the view unmounts or the status changes. Reduced motion shows a still rule instead.
 */
function WaitCue() {
  const { reduceMotion } = useMotionPreference();
  const [width, setWidth] = useState(0);
  const [started, setStarted] = useState(false);
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), tokens.motion.duration.estimateProgressDelay);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!started || reduceMotion || width === 0) return;
    const { durationMs, restMs } = tokens.motion.recipe.estimateWait;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.linear,
          useNativeDriver,
        }),
        Animated.delay(restMs),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, started, sweep, width]);

  if (!started) return null;

  const segment = width / 3;
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-segment, width] });

  return (
    <View
      style={styles.cueTrack}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {reduceMotion ? (
        <View style={[styles.cueSegment, styles.cueStill]} />
      ) : (
        <Animated.View
          style={[styles.cueSegment, { width: segment, transform: [{ translateX }] }]}
        />
      )}
    </View>
  );
}

/**
 * The estimate reveal: label, value, and caption arrive as one unit, so there is never a frame
 * with an unlabelled price. Reduced motion uses a short cross-fade with no travel.
 */
function RevealedEstimate({ value, animate }: { value: string; animate: boolean }) {
  const { reduceMotion, resolveRecipe } = useMotionPreference();
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    const recipe = resolveRecipe('estimateReveal');
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: recipe.durationMs,
      easing: reduceMotion ? Easing.out(Easing.quad) : revealEasing,
      useNativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [animate, progress, reduceMotion, resolveRecipe]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [tokens.spacing[3], 0],
  });

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{ opacity: progress, transform: reduceMotion ? [] : [{ translateY }] }}
    >
      <EstimateBadge value={value} size="hero" />
    </Animated.View>
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
  return (
    <Surface padding={tokens.spacing[4]} contentStyle={styles.problem}>
      <View style={styles.problemHeader} accessibilityLiveRegion="assertive">
        <Icon size={20} strokeWidth={2} color={tokens.color.dark.danger} />
        <SWText variant="headingMedium" style={styles.problemTitle}>
          {title}
        </SWText>
      </View>
      <SWText variant="bodySmall" tone="textSecondary">
        {body}
      </SWText>
      <Button label="Try again" icon={RotateCw} onPress={onRetry} />
    </Surface>
  );
}

function Destinations({
  onListForSale,
  onPostToFeed,
  onKeepPrivate,
}: Pick<EstimateResultViewProps, 'onListForSale' | 'onPostToFeed' | 'onKeepPrivate'>) {
  return (
    <BottomBar>
      <Reveal index={2} style={styles.sheetBody}>
        <SWText variant="overline" tone="textMuted" style={styles.sheetLabel}>
          What next
        </SWText>
        <Button
          label="List for sale"
          icon={ShoppingBag}
          accessibilityHint="Opens price confirmation. You set the asking price yourself."
          onPress={onListForSale}
        />
        <View style={styles.secondaryRow}>
          <Button
            label="Ask the feed"
            variant="secondary"
            icon={Users}
            onPress={onPostToFeed}
            containerStyle={styles.half}
          />
          <Button
            label="Keep private"
            variant="secondary"
            icon={EyeOff}
            onPress={onKeepPrivate}
            containerStyle={styles.half}
          />
        </View>
      </Reveal>
    </BottomBar>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: tokens.spacing[2],
    gap: tokens.spacing[8],
  },
  lockup: {
    gap: tokens.spacing[3],
  },
  status: {
    gap: tokens.spacing[1],
    paddingVertical: tokens.spacing[2],
  },
  cueTrack: {
    position: 'absolute',
    left: tokens.spacing[4],
    right: tokens.spacing[4],
    bottom: tokens.spacing[4],
    height: tokens.layout.progressSegment,
    borderRadius: tokens.radius.full,
    overflow: 'hidden',
    backgroundColor: tokens.overlay.chrome,
  },
  cueSegment: {
    height: '100%',
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.dark.accent,
  },
  cueStill: {
    width: '100%',
  },
  problem: {
    gap: tokens.spacing[3],
  },
  problemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  problemTitle: {
    flex: 1,
  },
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  fields: {
    gap: tokens.spacing[4],
  },
  sheetLabel: {
    marginBottom: tokens.spacing[1],
  },
  sheetBody: {
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingTop: tokens.spacing[4],
    paddingBottom: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
  },
  half: {
    flex: 1,
  },
});
