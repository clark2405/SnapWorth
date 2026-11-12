import {
  Bell,
  History,
  MessagesSquare,
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
  PriceTagIcon,
  Rating,
  Reveal,
  Screen,
  SegmentedControl,
  Sheet,
  Sparkline,
  Surface,
  SWText,
  Tag,
  TextField,
} from '../../components';
import {
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  type ThemePreference,
} from '../../design';
import {
  confirmsDeletion,
  deleteConfirmationWord,
  type DeleteAccountOutcome,
} from '../auth/account-deletion';
import { useReviewCount } from '../admin/admin-state';
import { formatPeso, previewPortfolio } from '../preview/sample-data';
import { useFeed } from '../feed/feed-state';
import { useScanHistory } from '../history/scan-history-state';
import { useBackendMode } from '../session/backend-mode';
import { avatarSourceFor, previewProfileId, useUserProfile } from './userProfile';

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
   * Permanently deletes the account and its data, once the person has typed the confirmation
   * word (see `deleteAccount`). Apple requires apps that create accounts to offer deletion in
   * the app, not just deactivation.
   */
  readonly onDeleteAccount?: (typed: string) => Promise<DeleteAccountOutcome> | void;
}

const appearanceOptions: readonly { readonly key: ThemePreference; readonly label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

/** The way into the review queue, with how many cases wait once the database has said. */
function ModerationRow({ onPress }: { readonly onPress: () => void }) {
  const waiting = useReviewCount();
  return (
    <ListRow
      label="Moderation"
      icon={ShieldAlert}
      value={waiting === null ? undefined : String(waiting)}
      onPress={onPress}
    />
  );
}

/** A count for a row, or a dash when it couldn't be loaded. */
const countText = (count: number | null) => (count === null ? '–' : String(count));

export function ProfileView({ onBack, onOpen, onLogOut, onDeleteAccount }: ProfileViewProps) {
  const { colors, preference, setPreference } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const { profile } = useUserProfile();
  const scanHistory = useScanHistory();
  const feed = useFeed();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteProblem, setDeleteProblem] = useState<string | null>(null);
  // What they've checked is their saved scans, including ones still on their way to Supabase;
  // the preview profile keeps its sample count.
  const checked =
    profile.id !== previewProfileId && scanHistory.status === 'ready'
      ? scanHistory.scans.length
      : profile.stats.checked;
  // The collection is worth what the AI said of the account's own scans. The sample total and its
  // trend stand in only on a device with no Supabase project and no scans yet.
  const mode = useBackendMode();
  const collectionIsSample = mode === 'device' && scanHistory.scans.length === 0;
  const collectionTotal = scanHistory.scans.reduce((sum, scan) => sum + scan.estimate, 0);
  const votesCount =
    profile.id !== previewProfileId && !feed.loading
      ? feed.userVotes.length
      : profile.activity.votes;

  const closeDelete = () => {
    if (deleting) return;
    setConfirmingDelete(false);
    setTyped('');
    setDeleteProblem(null);
  };
  const deleteAccount = async () => {
    if (deleting || !confirmsDeletion(typed)) return;
    setDeleting(true);
    setDeleteProblem(null);
    const outcome = await onDeleteAccount?.(typed);
    setDeleting(false);
    if (outcome?.kind === 'failed') {
      setDeleteProblem(outcome.message);
      return;
    }
    setConfirmingDelete(false);
    setTyped('');
  };

  const stats = [
    { label: 'Checked', value: checked },
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
          <Avatar
            source={avatarSourceFor(profile.avatarUrl)}
            name={profile.displayName || profile.handle}
            size={72}
            ring
          />
          <View style={styles.identityText}>
            <SWText variant="displayMedium" accessibilityRole="header">
              {profile.displayName}
            </SWText>
            <View style={styles.handleRow}>
              <SWText variant="bodySmall" tone="accent">
                @{profile.handle}
              </SWText>
              {profile.email ? (
                <SWText variant="bodySmall" tone="textSecondary">
                  · {profile.email} ·
                </SWText>
              ) : (
                <SWText variant="bodySmall" tone="textSecondary">
                  ·
                </SWText>
              )}
              {profile.rating === null ? null : (
                <Rating value={profile.rating} variant="bodySmall" tone="textSecondary" />
              )}
            </View>
            {profile.bio ? (
              <SWText variant="bodySmall" tone="textSecondary" numberOfLines={2}>
                {profile.bio}
              </SWText>
            ) : null}
            <View style={styles.metaRow}>
              <SWText variant="caption" tone="textMuted">
                {profile.location}
              </SWText>
              <SWText variant="caption" tone="textMuted">
                · {profile.joined}
              </SWText>
            </View>
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
            <View
              accessible
              accessibilityLabel={`${stat.value ?? 'unknown'} ${stat.label.toLowerCase()}`}
            >
              {/* A count that couldn't be loaded is shown as unknown, never as 0. */}
              {stat.value === null ? (
                <SWText variant="priceMedium">–</SWText>
              ) : (
                <CountUp
                  value={stat.value}
                  format={(value) => String(Math.round(value))}
                  variant="priceMedium"
                />
              )}
              <SWText variant="labelSmall" tone="textSecondary">
                {stat.label}
              </SWText>
            </View>
          </Surface>
        ))}
      </Reveal>

      {collectionIsSample || collectionTotal > 0 ? (
        <Reveal index={2}>
          <Surface tone="feature" padding={tokens.spacing[5]} contentStyle={styles.collectionCard}>
            <Overline icon={Wallet} label="Collection value" tone="onFeatureDim" />
            <CountUp
              value={collectionIsSample ? previewPortfolio.total : collectionTotal}
              format={formatPeso}
              variant="priceLarge"
              tone="onFeature"
            />
            {collectionIsSample ? (
              <>
                <Tag label={previewPortfolio.changeLabel} tone="mint" />
                <Sparkline values={previewPortfolio.series} height={56} color={colors.onFeature} />
              </>
            ) : null}
          </Surface>
        </Reveal>
      ) : null}

      <Reveal index={3} style={styles.sections}>
        <ListGroup title="Your activity" icon={History}>
          <ListRow
            label="Your listings"
            icon={PriceTagIcon}
            value={countText(profile.activity.listings)}
            onPress={() => onOpen?.('listings')}
          />
          <ListRow
            label="Votes cast"
            icon={Vote}
            value={countText(votesCount)}
            onPress={() => onOpen?.('votes')}
          />
          <ListRow
            label="Conversations"
            icon={MessagesSquare}
            value={countText(profile.activity.conversations)}
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
          {profile.isAdmin ? <ModerationRow onPress={() => onOpen?.('moderation')} /> : null}
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

      {/* Deleting can't be undone, so this is the one place the app stops to confirm, and asks
          for a typed word: everyone has one, even accounts with no password (Google, Apple). */}
      <Sheet visible={confirmingDelete} onClose={closeDelete} title="Delete your account?">
        <View style={styles.deleteSheet}>
          <SWText variant="bodyMedium" tone="textSecondary">
            This permanently removes your profile, items, listings, votes, comments and chats. It
            can&apos;t be undone. You can still look around SnapWorth without an account.
          </SWText>
          <View style={styles.deleteConfirm}>
            <SWText variant="labelSmall" tone="textSecondary">
              {`Type ${deleteConfirmationWord} to confirm`}
            </SWText>
            <TextField
              value={typed}
              onChangeText={(value) => {
                setTyped(value);
                setDeleteProblem(null);
              }}
              onSubmitEditing={deleteAccount}
              placeholder={deleteConfirmationWord}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="done"
              editable={!deleting}
              accessibilityLabel={`Type ${deleteConfirmationWord} to confirm`}
            />
            {deleteProblem ? (
              <SWText variant="bodySmall" tone="danger" accessibilityLiveRegion="assertive">
                {deleteProblem}
              </SWText>
            ) : null}
          </View>
          <View style={styles.deleteActions}>
            <Button
              label={deleting ? 'Deleting…' : 'Delete account'}
              variant="danger"
              loading={deleting}
              disabled={!confirmsDeletion(typed)}
              onPress={deleteAccount}
            />
            <Button label="Keep my account" variant="secondary" onPress={closeDelete} />
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
    flexWrap: 'wrap',
  },
  metaRow: {
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
  deleteConfirm: {
    gap: tokens.spacing[2],
  },
  deleteActions: {
    gap: tokens.spacing[2],
  },
}));
