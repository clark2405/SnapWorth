import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { themedStyles, tokens, useTheme, useThemedStyles, type SemanticColorName } from '../design';
import { SWText } from './SWText';

/**
 * Soft tonal chips for categories and statuses: `sand` is neutral, `mint` positive, `grave`
 * archived or done, `warn` needs attention, `danger` destructive. `inverse` is a solid ink chip
 * for the rare label that sits on a photo. None of them is ever the accent.
 */
export type TagTone = 'sand' | 'mint' | 'grave' | 'warn' | 'danger' | 'inverse';

const palette: Record<TagTone, { fill: SemanticColorName; ink: SemanticColorName }> = {
  sand: { fill: 'sand', ink: 'sandInk' },
  mint: { fill: 'mint', ink: 'mintInk' },
  grave: { fill: 'grave', ink: 'graveInk' },
  warn: { fill: 'accentSoft', ink: 'accentPressed' },
  danger: { fill: 'dangerSoft', ink: 'danger' },
  inverse: { fill: 'inverse', ink: 'onInverse' },
};

export interface TagProps {
  readonly label: string;
  readonly tone?: TagTone;
  /** A leading emoji for personality, e.g. "🏷️ Listed". */
  readonly emoji?: string;
  readonly icon?: LucideIcon;
}

export function Tag({ label, tone = 'sand', emoji, icon: Icon }: TagProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const { fill, ink } = palette[tone];

  return (
    <View style={[styles.tag, { backgroundColor: colors[fill] }]}>
      {Icon ? <Icon size={12} strokeWidth={2.4} color={colors[ink]} /> : null}
      {emoji ? (
        <SWText variant="tag" accessibilityElementsHidden importantForAccessibility="no">
          {emoji}
        </SWText>
      ) : null}
      <SWText variant="tag" tone={ink}>
        {label}
      </SWText>
    </View>
  );
}

const stylesFor = themedStyles(() => ({
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    borderRadius: tokens.radius.full,
    paddingHorizontal: tokens.spacing[2] + 2,
    paddingVertical: 3,
  },
}));
