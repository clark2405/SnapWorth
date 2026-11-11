import { MapPin } from 'lucide-react-native';
import { View } from 'react-native';

import { Divider, PressableScale, Reveal, Surface, SWText } from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import { meetupWhenLabel } from './meetup-reminder-plan';
import { useUpcomingMeetups } from './meetup-reminders';

/** How many to list; the rest are a tap away in their own chats. */
const shown = 3;

/**
 * The meetups you've agreed to, soonest first, at the top of Chats: when, where and with whom,
 * and a tap opens the chat. It's the reminder that works everywhere, including the web, where a
 * closed tab can't be woken; on the phone it sits beside the local notifications.
 */
export function UpcomingMeetups({
  onOpenConversation,
}: {
  readonly onOpenConversation?: (conversationId: string) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const { meetups, now } = useUpcomingMeetups();
  if (meetups.length === 0) return null;

  return (
    <Reveal index={0} style={styles.card}>
      <SWText variant="overline" tone="textMuted" accessibilityRole="header">
        Upcoming meetups
      </SWText>
      <Surface padding={tokens.spacing[2]}>
        {meetups.slice(0, shown).map((meetup, index) => {
          const when = meetupWhenLabel(meetup.startsAt, now);
          const what = meetup.purpose === 'viewing' ? 'Viewing' : 'Pickup';
          return (
            <View key={meetup.messageId}>
              {index > 0 ? <Divider style={styles.divider} /> : null}
              <PressableScale
                accessibilityLabel={`${what} of ${meetup.listingTitle} with ${meetup.handle} at ${meetup.place}, ${when}`}
                accessibilityHint="Opens the chat"
                depth="surface"
                haptic="none"
                onPress={() => onOpenConversation?.(meetup.conversationId)}
                style={styles.row}
              >
                <MapPin size={20} strokeWidth={2.2} color={colors.accent} />
                <View style={styles.text}>
                  <SWText variant="headingSmall" numberOfLines={1}>
                    {when}
                  </SWText>
                  <SWText variant="caption" tone="textSecondary" numberOfLines={2}>
                    {`${what} · ${meetup.listingTitle} with @${meetup.handle} at ${meetup.place}`}
                  </SWText>
                </View>
              </PressableScale>
            </View>
          );
        })}
      </Surface>
    </Reveal>
  );
}

const stylesFor = themedStyles(() => ({
  card: {
    gap: tokens.spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    padding: tokens.spacing[3],
  },
  text: {
    flex: 1,
    gap: tokens.spacing[1],
  },
  divider: {
    marginHorizontal: tokens.spacing[3],
  },
}));
