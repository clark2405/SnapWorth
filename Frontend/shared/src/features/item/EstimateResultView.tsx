import { CircleCheck, EyeOff, Share2, ShoppingBag, Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  GlassCard,
  GlassField,
  GlassInput,
  GlassSelect,
  GlowButton,
  IconButton,
  NavHeader,
  Photo,
  Reveal,
  Screen,
  SWText,
} from '../../components';
import { tokens } from '../../design';
import { formatPeso, previewItem } from '../preview/sample-data';

export interface EstimateResultViewProps {
  readonly itemId?: string;
  readonly onBack?: () => void;
  readonly onShare?: () => void;
  readonly onPostToFeed?: () => void;
  readonly onListForSale?: () => void;
  readonly onKeepPrivate?: () => void;
}

export function EstimateResultView({
  onBack,
  onShare,
  onPostToFeed,
  onListForSale,
  onKeepPrivate,
}: EstimateResultViewProps) {
  const item = previewItem;
  const [title, setTitle] = useState<string>(item.title);

  return (
    <Screen
      header={
        <NavHeader
          title="AI Valuation"
          onBack={onBack}
          trailing={<IconButton icon={Share2} label="Share this estimate" onPress={onShare} />}
        />
      }
      footer={
        <GlassCard tone="chrome" blur radius={0} style={styles.sheet}>
          <View style={styles.sheetBody}>
            <SWText variant="label" style={styles.sheetLabel}>
              Choose what to do next:
            </SWText>
            <GlowButton
              label="Post to Community Feed for Pricing Help"
              variant="mintGlass"
              icon={Users}
              onPress={onPostToFeed}
            />
            <GlowButton
              label="List For Sale on Marketplace"
              icon={ShoppingBag}
              accessibilityHint="Opens price confirmation. You set the asking price yourself."
              onPress={onListForSale}
            />
            <GlowButton
              label="Keep Private in My Locker"
              variant="mintOutline"
              icon={EyeOff}
              onPress={onKeepPrivate}
            />
          </View>
        </GlassCard>
      }
      contentStyle={styles.content}
    >
      <Reveal index={0}>
        <Photo source={item.photo} label={item.photoLabel} aspectRatio={362 / 219} />
      </Reveal>

      <Reveal index={1}>
        <GlassCard tone="mint" padding={tokens.spacing[5]} contentStyle={styles.estimate}>
          <SWText variant="overline" tone="accent">
            AI Price Estimate
          </SWText>
          <SWText
            variant="priceHero"
            tone="accent"
            accessibilityLabel={`AI estimate ${formatPeso(item.estimate)}. This is an estimate, not a listing price.`}
          >
            {formatPeso(item.estimate)}
          </SWText>
          <SWText variant="caption" tone="textMuted">
            AI Estimate — not a listing price
          </SWText>
        </GlassCard>
      </Reveal>

      <Reveal index={2} style={styles.saved}>
        <CircleCheck size={16} strokeWidth={2} color={tokens.color.dark.accent} />
        <SWText variant="labelMedium" tone="textSecondary">
          Saved to history
        </SWText>
      </Reveal>

      <Reveal index={3} style={styles.fields}>
        <GlassField label="Identified Item">
          <GlassInput value={title} onChangeText={setTitle} accessibilityLabel="Identified item" />
        </GlassField>
        <GlassField label="Category">
          <GlassSelect value={item.category} accessibilityLabel="Category" />
        </GlassField>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: tokens.spacing[2],
    gap: tokens.spacing[5],
  },
  estimate: {
    gap: tokens.spacing[1],
  },
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    alignSelf: 'stretch',
    marginTop: -tokens.spacing[2],
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[1] + 2,
    borderRadius: tokens.radius.small,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.glass.border,
    backgroundColor: tokens.glass.fill,
  },
  fields: {
    gap: tokens.spacing[4],
  },
  sheet: {
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  sheetLabel: {
    marginBottom: tokens.spacing[1],
  },
  sheetBody: {
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingTop: tokens.spacing[5],
    paddingBottom: tokens.spacing[4],
    gap: tokens.spacing[2],
  },
});
