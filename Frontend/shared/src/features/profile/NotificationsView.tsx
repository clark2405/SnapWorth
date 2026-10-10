import {
  BellOff,
  BellRing,
  Settings,
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

import { ListGroup, ListRow, NavHeader, Reveal, Screen, SWText, Toggle } from '../../components';
import { haptic, themedStyles, tokens, useThemedStyles } from '../../design';

/** What a notification is about, which is what each switch on the screen turns on or off. */
export type NotificationKey =
  'estimates' | 'votes' | 'comments' | 'messages' | 'offers' | 'price-drops' | 'trends' | 'tips';

export interface NotificationPreferences {
  /** Silences everything without losing the choices underneath. */
  readonly paused: boolean;
  readonly enabled: Readonly<Record<NotificationKey, boolean>>;
}

/**
 * Whether the system lets SnapWorth notify at all. `unsupported` is a browser without
 * notifications.
 */
export type NotificationAccess = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export interface NotificationsViewProps {
  readonly onBack?: () => void;
  /** The saved choices; without them the screen keeps its own, for previews. */
  readonly preferences?: NotificationPreferences;
  readonly onChange?: (preferences: NotificationPreferences) => void;
  readonly access?: NotificationAccess;
  /** Asks the system for permission, the first time. */
  readonly onAllow?: () => void;
  /** Opens the system settings, where a refused permission can be turned back on. */
  readonly onOpenSettings?: () => void;
}

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
export const defaultNotificationPreferences: NotificationPreferences = {
  paused: false,
  enabled: {
    estimates: true,
    votes: true,
    comments: true,
    messages: true,
    offers: true,
    'price-drops': true,
    trends: true,
    tips: false,
  },
};

/** Whether the person wants to hear about `key` right now. */
export function wantsNotification(preferences: NotificationPreferences, key: NotificationKey) {
  return !preferences.paused && preferences.enabled[key];
}

/**
 * What SnapWorth may tap you on the shoulder about, grouped by why it would: your items, your
 * deals, and the occasional note from us. Pausing silences everything without losing the
 * choices underneath.
 */
export function NotificationsView({
  onBack,
  preferences,
  onChange,
  access = 'granted',
  onAllow,
  onOpenSettings,
}: NotificationsViewProps) {
  const styles = useThemedStyles(stylesFor);
  const [own, setOwn] = useState(defaultNotificationPreferences);
  const current = preferences ?? own;
  const { paused, enabled } = current;

  const change = (next: NotificationPreferences) => {
    haptic('select');
    setOwn(next);
    onChange?.(next);
  };
  const toggle = (key: NotificationKey, value: boolean) => {
    change({ ...current, enabled: { ...enabled, [key]: value } });
    // Turning something on is the moment to ask, when the reason is obvious.
    if (value && access === 'undetermined') onAllow?.();
  };

  return (
    <Screen
      header={<NavHeader title="Notifications" onBack={onBack} banded />}
      contentStyle={styles.content}
    >
      {access === 'undetermined' || (access === 'denied' && onOpenSettings) ? (
        <Reveal index={0}>
          <ListGroup>
            {access === 'undetermined' ? (
              <ListRow
                label="Allow notifications"
                detail="So the ones you choose below can reach you"
                icon={BellRing}
                onPress={onAllow}
              />
            ) : (
              <ListRow
                label="Notifications are off"
                detail="Turn them on for SnapWorth in Settings"
                icon={Settings}
                onPress={onOpenSettings}
              />
            )}
          </ListGroup>
        </Reveal>
      ) : null}

      <Reveal index={0}>
        <ListGroup>
          <ListRow
            label="Pause all"
            detail={paused ? 'Nothing will notify you until you turn this off' : undefined}
            icon={BellOff}
            trailing={
              <Toggle
                value={paused}
                onValueChange={(value) => change({ ...current, paused: value })}
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
                  <Toggle
                    value={enabled[option.key]}
                    disabled={paused}
                    onValueChange={(value) => toggle(option.key, value)}
                    accessibilityLabel={option.label}
                  />
                }
              />
            ))}
          </ListGroup>
        </Reveal>
      ))}

      <SWText variant="caption" tone="textMuted" style={styles.footnote}>
        {access === 'unsupported'
          ? 'This browser can’t show notifications; your choices still apply in the app.'
          : 'You can also turn SnapWorth’s notifications off entirely in your phone’s Settings.'}
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
