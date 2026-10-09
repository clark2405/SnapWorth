import {
  BellOff,
  Flame,
  Handshake,
  Lightbulb,
  MessageCircle,
  MessagesSquare,
  Sparkles,
  TrendingDown,
  Vote,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Switch } from 'react-native';

import { ListGroup, ListRow, NavHeader, Reveal, Screen, SWText } from '../../components';
import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';

export interface NotificationsViewProps {
  readonly onBack?: () => void;
}

type NotificationKey =
  'estimates' | 'votes' | 'comments' | 'messages' | 'offers' | 'price-drops' | 'trends' | 'tips';

interface NotificationOption {
  readonly key: NotificationKey;
  readonly label: string;
  readonly detail: string;
  readonly icon: LucideIcon;
}

const groups: readonly {
  readonly title: string;
  readonly icon: LucideIcon;
  readonly options: readonly NotificationOption[];
}[] = [
  {
    title: 'Your items',
    icon: Sparkles,
    options: [
      {
        key: 'estimates',
        label: 'Estimate ready',
        detail: 'When a snap has been valued',
        icon: Sparkles,
      },
      {
        key: 'votes',
        label: 'Votes on your posts',
        detail: 'One daily roundup, not every vote',
        icon: Vote,
      },
      {
        key: 'comments',
        label: 'Comments and replies',
        detail: 'On your posts and your comments',
        icon: MessageCircle,
      },
    ],
  },
  {
    title: 'Buying and selling',
    icon: Handshake,
    options: [
      {
        key: 'messages',
        label: 'Messages',
        detail: 'From buyers and sellers',
        icon: MessagesSquare,
      },
      { key: 'offers', label: 'Offers', detail: 'New offers and counter-offers', icon: Handshake },
      {
        key: 'price-drops',
        label: 'Price drops',
        detail: 'On listings you saved',
        icon: TrendingDown,
      },
    ],
  },
  {
    title: 'From SnapWorth',
    icon: Flame,
    options: [
      {
        key: 'trends',
        label: 'Hot this month',
        detail: 'A monthly note on what is trending',
        icon: Flame,
      },
      {
        key: 'tips',
        label: 'Tips',
        detail: 'Now and then, how to get more from the app',
        icon: Lightbulb,
      },
    ],
  },
];

// Everything about your own items and deals is on; news from SnapWorth is opt-in apart from
// the monthly trends note.
const defaults: Record<NotificationKey, boolean> = {
  estimates: true,
  votes: true,
  comments: true,
  messages: true,
  offers: true,
  'price-drops': true,
  trends: true,
  tips: false,
};

/**
 * What SnapWorth may tap you on the shoulder about, grouped by why it would: your items, your
 * deals, and the occasional note from us. Pausing silences everything without losing the
 * choices underneath.
 */
export function NotificationsView({ onBack }: NotificationsViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const [paused, setPaused] = useState(false);
  const [enabled, setEnabled] = useState(defaults);

  const toggle = (key: NotificationKey, value: boolean) => {
    haptic('select');
    setEnabled((current) => ({ ...current, [key]: value }));
  };

  return (
    <Screen
      header={<NavHeader title="Notifications" onBack={onBack} banded />}
      contentStyle={styles.content}
    >
      <Reveal index={0}>
        <ListGroup>
          <ListRow
            label="Pause all"
            detail={paused ? 'Nothing will notify you until you turn this off' : undefined}
            icon={BellOff}
            trailing={
              <Switch
                value={paused}
                onValueChange={(value) => {
                  haptic('select');
                  setPaused(value);
                }}
                trackColor={{ false: colors.sunken, true: colors.textPrimary }}
                accessibilityLabel="Pause all notifications"
              />
            }
          />
        </ListGroup>
      </Reveal>

      {groups.map((group, groupIndex) => (
        <Reveal key={group.title} index={groupIndex + 1} style={paused ? styles.muted : null}>
          <ListGroup title={group.title} icon={group.icon}>
            {group.options.map((option) => (
              <ListRow
                key={option.key}
                label={option.label}
                detail={option.detail}
                icon={option.icon}
                trailing={
                  <Switch
                    value={enabled[option.key]}
                    disabled={paused}
                    onValueChange={(value) => toggle(option.key, value)}
                    trackColor={{ false: colors.sunken, true: colors.textPrimary }}
                    accessibilityLabel={option.label}
                  />
                }
              />
            ))}
          </ListGroup>
        </Reveal>
      ))}

      <SWText variant="caption" tone="textMuted" style={styles.footnote}>
        You can also turn SnapWorth's notifications off entirely in your phone's Settings.
      </SWText>
    </Screen>
  );
}

const stylesFor = themedStyles(() => ({
  content: {
    paddingTop: tokens.spacing[4],
    gap: tokens.spacing[6],
  },
  muted: {
    opacity: 0.5,
  },
  footnote: {
    paddingHorizontal: tokens.spacing[1],
  },
}));
