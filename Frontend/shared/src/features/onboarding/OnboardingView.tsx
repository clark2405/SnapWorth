import { useRef, useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EstimateBadge, Photo, Reveal, SWText, VoteChips } from '../../components';
import { tokens, useMotionPreference } from '../../design';
import { formatPeso, previewItem, previewListings, previewPosts } from '../preview/sample-data';

export interface OnboardingViewProps {
  /** The last step's primary action: start a new account. */
  readonly onGetStarted?: () => void;
  /** For returning users on any step. */
  readonly onSignIn?: () => void;
  /** Leaves the introduction early. */
  readonly onSkip?: () => void;
}

interface Step {
  readonly key: string;
  readonly chapter: string;
  readonly title: string;
  readonly body: string;
  readonly illustration: ReactNode;
}

const cameraListing = previewListings[0];
const votedPost = previewPosts[0];

const bracketCorners = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;

/** Step 1: the viewfinder closes on an item, the same mark the launch screen draws. */
function SnapIllustration() {
  return (
    <View style={styles.illustration}>
      {cameraListing ? (
        <Photo
          source={cameraListing.photo}
          label={cameraListing.photoLabel}
          radius={tokens.radius.large}
          style={styles.photoFill}
        />
      ) : null}
      <View style={styles.viewfinder} pointerEvents="none">
        {bracketCorners.map((corner) => (
          <View key={corner} style={[styles.bracket, styles[corner]]} />
        ))}
      </View>
    </View>
  );
}

/** Step 2: the photo resolves into an estimate that is labelled and captioned as one. */
function EstimateIllustration() {
  return (
    <View style={styles.illustration}>
      <Photo
        source={previewItem.photo}
        label={previewItem.photoLabel}
        radius={tokens.radius.large}
        style={styles.photoFill}
      />
      <View style={styles.anchor}>
        <EstimateBadge value={formatPeso(previewItem.estimate)} />
      </View>
    </View>
  );
}

/** Step 3: the community weighs in; the seller still decides. */
function DecideIllustration() {
  return (
    <View style={styles.illustration}>
      {votedPost ? (
        <>
          <Photo
            source={votedPost.photo}
            label={votedPost.photoLabel}
            radius={tokens.radius.large}
            style={styles.photoFill}
          />
          <View style={[styles.anchor, styles.votePanel]}>
            <SWText variant="overline" tone="textMuted">
              Community vote
            </SWText>
            <VoteChips tally={votedPost.votes} selected="just_right" />
          </View>
        </>
      ) : null}
    </View>
  );
}

const steps: readonly Step[] = [
  {
    key: 'snap',
    chapter: '01 — Snap',
    title: 'One photo. That’s it.',
    body: 'Point your camera at something you own. The photo is saved to your history first, so nothing is lost.',
    illustration: <SnapIllustration />,
  },
  {
    key: 'estimate',
    chapter: '02 — Estimate',
    title: 'See what it’s worth.',
    body: 'An AI estimate arrives in seconds. It is always marked as an estimate, because it is a starting point, not a promise.',
    illustration: <EstimateIllustration />,
  },
  {
    key: 'decide',
    chapter: '03 — Decide',
    title: 'Your item. Your call.',
    body: 'Let the community vote on the price, list it at a price you set yourself, or keep it private.',
    illustration: <DecideIllustration />,
  },
];

/**
 * First-run introduction: three short chapters that show the photo-to-price loop with the
 * product's own pieces, then hand off to account creation. Swipe or use Continue; skippable at
 * every step.
 */
export function OnboardingView({ onGetStarted, onSignIn, onSkip }: OnboardingViewProps) {
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useMotionPreference();
  const pager = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const last = index === steps.length - 1;

  const onLayout = (event: LayoutChangeEvent) => setPageWidth(event.nativeEvent.layout.width);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth === 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (next !== index && next >= 0 && next < steps.length) setIndex(next);
  };

  const goTo = (next: number) => {
    pager.current?.scrollTo({ x: next * pageWidth, animated: !reduceMotion });
    setIndex(next);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.column}>
        <Reveal index={0} style={styles.topBar}>
          <SWText variant="wordmark">SnapWorth</SWText>
          {last ? null : <Button label="Skip" variant="tertiary" onPress={onSkip} />}
        </Reveal>

        <Reveal index={1} style={styles.pagerArea}>
          <View style={styles.fill} onLayout={onLayout}>
            {pageWidth > 0 ? (
              <ScrollView
                ref={pager}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                style={styles.fill}
              >
                {steps.map((step, stepIndex) => (
                  <View
                    key={step.key}
                    style={[styles.page, { width: pageWidth }]}
                    accessibilityElementsHidden={stepIndex !== index}
                    importantForAccessibility={stepIndex === index ? 'auto' : 'no-hide-descendants'}
                  >
                    {step.illustration}
                    <View style={styles.copy}>
                      <SWText variant="overline" tone="textMuted">
                        {step.chapter}
                      </SWText>
                      <SWText variant="displayHero" accessibilityRole="header">
                        {step.title}
                      </SWText>
                      <SWText variant="bodyLarge" tone="textSecondary">
                        {step.body}
                      </SWText>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        </Reveal>

        <Reveal index={2} style={styles.footer}>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${index + 1} of ${steps.length}`}
            accessibilityValue={{ min: 1, max: steps.length, now: index + 1 }}
            style={styles.progress}
          >
            {steps.map((step, stepIndex) => (
              <View
                key={step.key}
                style={[styles.segment, stepIndex <= index ? styles.segmentDone : null]}
              />
            ))}
          </View>
          <Button
            label={last ? 'Get started' : 'Continue'}
            onPress={last ? onGetStarted : () => goTo(index + 1)}
            accessibilityHint={last ? 'Creates your SnapWorth account' : undefined}
          />
          <Button label="I already have an account" variant="tertiary" onPress={onSignIn} />
        </Reveal>
      </View>
    </View>
  );
}

const bracket = tokens.layout.viewfinderBracket;
const stroke = tokens.layout.progressSegment;
const gutter = tokens.layout.pageGutterCompact;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.color.dark.canvas,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: tokens.layout.phoneColumn,
    alignSelf: 'center',
  },
  fill: {
    flex: 1,
  },
  topBar: {
    minHeight: tokens.layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: gutter,
    paddingRight: gutter - tokens.spacing[2],
  },
  pagerArea: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: gutter,
    paddingTop: tokens.spacing[2],
    gap: tokens.spacing[8],
  },
  illustration: {
    flex: 1,
    minHeight: 0,
  },
  photoFill: {
    flex: 1,
  },
  viewfinder: {
    position: 'absolute',
    top: tokens.spacing[6],
    right: tokens.spacing[6],
    bottom: tokens.spacing[6],
    left: tokens.spacing[6],
  },
  bracket: {
    position: 'absolute',
    width: bracket * 1.6,
    height: bracket * 1.6,
    borderColor: tokens.color.dark.accent,
  },
  topLeft: { top: 0, left: 0, borderTopWidth: stroke, borderLeftWidth: stroke },
  topRight: { top: 0, right: 0, borderTopWidth: stroke, borderRightWidth: stroke },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: stroke, borderLeftWidth: stroke },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: stroke, borderRightWidth: stroke },
  anchor: {
    position: 'absolute',
    left: tokens.spacing[4],
    right: tokens.spacing[4],
    bottom: tokens.spacing[4],
  },
  votePanel: {
    gap: tokens.spacing[2],
    padding: tokens.spacing[3],
    borderRadius: tokens.radius.medium,
    backgroundColor: tokens.color.dark.surface,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.borderSubtle,
  },
  copy: {
    gap: tokens.spacing[3],
  },
  footer: {
    paddingHorizontal: gutter,
    paddingTop: tokens.spacing[6],
    paddingBottom: tokens.spacing[2],
    gap: tokens.spacing[3],
  },
  progress: {
    flexDirection: 'row',
    gap: tokens.spacing[2],
    marginBottom: tokens.spacing[3],
  },
  segment: {
    flex: 1,
    height: stroke,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.dark.borderStrong,
  },
  segmentDone: {
    backgroundColor: tokens.color.dark.textPrimary,
  },
});
