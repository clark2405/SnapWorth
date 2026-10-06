import {
  Bell,
  History,
  MessagesSquare,
  Tag as TagIcon,
  Vote,
  ChevronRight,
  CircleHelp,
  LogOut,
  ShieldAlert,
  Palette,
  Settings2,
  Sparkles,
  Wallet,
  TrendingDown,
  UserX,
} from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Avatar,
  Button,
  CountUp,
  ListGroup,
  ListRow,
  NavHeader,
  Overline,
  PressableScale,
  Rating,
  Reveal,
  Screen,
  SegmentedControl,
  Sheet,
  Sparkline,
  Surface,
  SWText,
  Tag,
} from '../../components';
import {
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  type ThemePreference,
} from '../../design';
import {
  formatPeso,
  previewHeldContent,
  previewPortfolio,
  previewConversations,
  previewProfile,
  previewVotesCast,
} from '../preview/sample-data';

export type ProfileDestination =
  | 'edit-profile'
  | 'listings'
  | 'votes'
  | 'conversations'
  | 'notifications'
  | 'price-alerts'
  | 'privacy'
  | 'moderation'
  | 'help'
  | 'terms'
  | 'introduction';

export interface ProfileViewProps {
  readonly onBack?: () => void;
  readonly onOpen?: (destination: ProfileDestination) => void;
  readonly onLogOut?: () => void;
  /**
   * Permanently deletes the account and its data. Apple requires apps that create accounts to
   * offer deletion in the app, not just deactivation.
   */
  readonly onDeleteAccount?: () => void;
}

const appearanceOptions: readonly { readonly key: ThemePreference; readonly label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export function ProfileView({ onBack, onOpen, onLogOut, onDeleteAccount }: ProfileViewProps) {
  const { colors, preference, setPreference } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const profile = previewProfile;
  const stats = [
    { label: 'Checked', value: profile.stats.checked },
    { label: 'Listed', value: profile.stats.listed },
    { label: 'Sold', value: profile.stats.sold },
  ];

  return (
    <Screen header={<NavHeader title="Profile" onBack={onBack} />} contentStyle={styles.content}>
      <Reveal index={0}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          haptic="select"
          depth="surface"
          onPress={() => onOpen?.('edit-profile')}
          style={styles.identity}
        >
          <Avatar source={profile.user.avatar} name={profile.user.handle} size={72} ring />
          <View style={styles.identityText}>
            <SWText variant="displayTitle" accessibilityRole="header">
              {profile.displayName}
            </SWText>
            <View style={styles.handleRow}>
              <SWText variant="bodySmall" tone="textSecondary">
                @{profile.user.handle} ·
              </SWText>
              <Rating value={profile.rating} variant="bodySmall" tone="textSecondary" />
            </View>
            <SWText variant="caption" tone="textMuted">
              {profile.location}
            </SWText>
            <SWText variant="caption" tone="textMuted">
              {profile.joined}
            </SWText>
          </View>
          <ChevronRight size={18} strokeWidth={2} color={colors.textMuted} />
        </PressableScale>
      </Reveal>

      <Reveal index={1} style={styles.stats}>
        {stats.map((stat) => (
          <Surface
            key={stat.label}
            padding={tokens.spacing[4]}
            style={styles.statTile}
            contentStyle={styles.stat}
          >
            <View accessible accessibilityLabel={`${stat.value} ${stat.label.toLowerCase()}`}>
              <CountUp
                value={stat.value}
                format={(value) => String(Math.round(value))}
                variant="priceMedium"
              />
              <SWText variant="labelSmall" tone="textSecondary">
                {stat.label}
              </SWText>
            </View>
          </Surface>
        ))}
      </Reveal>

      <Reveal index={2}>
        <Surface tone="feature" padding={tokens.spacing[5]} contentStyle={styles.collectionCard}>
          <Overline icon={Wallet} label="Collection value" tone="onFeatureDim" />
          <CountUp
            value={previewPortfolio.total}
            format={formatPeso}
            variant="priceLarge"
            tone="onFeature"
          />
          <Tag label={previewPortfolio.changeLabel} tone="mint" />
          <Sparkline values={previewPortfolio.series} height={56} color={colors.onFeature} />
        </Surface>
      </Reveal>

      <Reveal index={3} style={styles.sections}>
        <ListGroup title="Your activity" icon={History}>
          <ListRow
            label="Your listings"
            icon={TagIcon}
            value={String(profile.stats.listed)}
            onPress={() => onOpen?.('listings')}
          />
          <ListRow
            label="Votes cast"
            icon={Vote}
            value={String(previewVotesCast.length)}
            onPress={() => onOpen?.('votes')}
          />
          <ListRow
            label="Conversations"
            icon={MessagesSquare}
            value={String(previewConversations.length)}
            onPress={() => onOpen?.('conversations')}
          />
        </ListGroup>

        <ListGroup title="The look" icon={Palette}>
          <View style={styles.appearanceRow}>
            <SegmentedControl
              options={appearanceOptions}
              value={preference}
              onChange={setPreference}
            />
          </View>
        </ListGroup>

        <ListGroup title="The fine print" icon={Settings2}>
          <ListRow label="Notifications" icon={Bell} onPress={() => onOpen?.('notifications')} />
          <ListRow
            label="Price alerts"
            icon={TrendingDown}
            onPress={() => onOpen?.('price-alerts')}
          />
          {profile.isAdmin ? (
            <ListRow
              label="Moderation"
              icon={ShieldAlert}
              value={String(previewHeldContent.length)}
              onPress={() => onOpen?.('moderation')}
            />
          ) : null}
          <ListRow label="Help" icon={CircleHelp} onPress={() => onOpen?.('help')} />
          <ListRow
            label="Replay introduction"
            icon={Sparkles}
            onPress={() => onOpen?.('introduction')}
          />
        </ListGroup>

        <ListGroup>
          <ListRow label="Log out" icon={LogOut} destructive onPress={onLogOut} />
          <ListRow
            label="Delete account"
            icon={UserX}
            destructive
            onPress={() => setConfirmingDelete(true)}
          />
        </ListGroup>
      </Reveal>

      {/* Deleting can't be undone, so this is the one place the app stops to confirm. */}
      <Sheet
        visible={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete your account?"
      >
        <View style={styles.deleteSheet}>
          <SWText variant="bodyMedium" tone="textSecondary">
            This permanently removes your profile, items, listings, votes, comments and chats. It
            can&apos;t be undone. You can still look around SnapWorth without an account.
          </SWText>
          <View style={styles.deleteActions}>
            <Button
              label="Delete account"
              variant="danger"
              onPress={() => {
                setConfirmingDelete(false);
                onDeleteAccount?.();
              }}
            />
            <Button
              label="Keep my account"
              variant="secondary"
              onPress={() => setConfirmingDelete(false)}
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const stylesFor = themedStyles(() => ({
  content: {
    paddingTop: tokens.spacing[4],
    gap: tokens.spacing[8],
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[4],
  },
  identityText: {
    flex: 1,
    gap: tokens.spacing[1],
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
  },
  stats: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
  },
  statTile: {
    flex: 1,
  },
  stat: {
    gap: tokens.spacing[1],
  },
  collectionCard: {
    gap: tokens.spacing[3],
  },
  sections: {
    gap: tokens.spacing[6],
  },
  appearanceRow: {
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
  },
  deleteSheet: {
    gap: tokens.spacing[5],
  },
  deleteActions: {
    gap: tokens.spacing[2],
  },
}));
