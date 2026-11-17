import {
  Ban,
  Check,
  EyeOff,
  Flag,
  History,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  Avatar,
  Button,
  ChoiceChips,
  EmptyState,
  NavHeader,
  PressableScale,
  Reveal,
  Screen,
  SegmentedControl,
  Sheet,
  Surface,
  SWText,
  Tag,
  TextField,
  Toggle,
  useOpenPerson,
  useToast,
} from '../../components';
import { held, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import type {
  ModeratedPerson,
  ModerationEntry,
  ModerationOverview,
  SuspendInput,
} from '../../ports/admin';
import { useAdminRepository, useAdminReview } from './admin-state';
import { ReviewQueue } from './AdminReviewView';
import { ageLabel, kindLabel } from './review-model';

type Tab = 'overview' | 'queue' | 'people' | 'history';

const tabs: readonly { readonly key: Tab; readonly label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'queue', label: 'Queue' },
  { key: 'people', label: 'People' },
  { key: 'history', label: 'History' },
];

export interface ModerationConsoleViewProps {
  readonly onBack?: () => void;
}

/**
 * The moderators' console, made for the website: the week at a glance, the queue of held and
 * reported content, people (look anyone up, see their record, suspend or reinstate them) and the
 * history of every decision. Everything comes from database functions that check the caller is
 * an admin, so this screen only ever shows what it's given.
 */
export function ModerationConsoleView({ onBack }: ModerationConsoleViewProps) {
  const styles = useThemedStyles(stylesFor);
  const { status } = useAdminReview();
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');

  const lookUp = (handle: string) => {
    setSearch(handle);
    setTab('people');
  };

  return (
    <Screen
      width="wide"
      header={<NavHeader title="Moderation" onBack={onBack} />}
      contentStyle={styles.content}
    >
      {status === 'denied' ? (
        <EmptyState
          icon={ShieldOff}
          title="This is for moderators"
          body="Your account isn’t a moderator. If that’s wrong, ask whoever runs SnapWorth."
        />
      ) : (
        <>
          <Reveal index={0} style={styles.top}>
            <SWText variant="displayMedium" accessibilityRole="header">
              Moderation
            </SWText>
            <SWText variant="bodySmall" tone="textMuted">
              Keep SnapWorth fair and friendly: review what’s held or reported, look people up, and
              suspend accounts that break the rules.
            </SWText>
          </Reveal>
          <SegmentedControl options={tabs} value={tab} onChange={setTab} />
          {tab === 'overview' ? <OverviewTab onOpen={setTab} /> : null}
          {tab === 'queue' ? <ReviewQueue onLookUp={lookUp} /> : null}
          {tab === 'people' ? <PeopleTab search={search} onSearch={setSearch} /> : null}
          {tab === 'history' ? <HistoryTab /> : null}
        </>
      )}
    </Screen>
  );
}

// -------------------------------------------------------------------------------------------
// Overview
// -------------------------------------------------------------------------------------------

function OverviewTab({ onOpen }: { readonly onOpen: (tab: Tab) => void }) {
  const styles = useThemedStyles(stylesFor);
  const repository = useAdminRepository();
  const [overview, setOverview] = useState<ModerationOverview | null | 'failed'>(null);

  const load = useCallback(async () => {
    const result = await repository.overview();
    setOverview(result.ok ? result.value : 'failed');
  }, [repository]);

  useEffect(() => {
    void load();
  }, [load]);

  if (overview === 'failed') return <LoadFailed onRetry={load} />;
  if (!overview) return null;

  const tiles: readonly {
    readonly label: string;
    readonly value: number;
    readonly icon: LucideIcon;
    readonly tab?: Tab;
    readonly urgent?: boolean;
  }[] = [
    {
      label: 'Waiting for review',
      value: overview.openCases,
      icon: Flag,
      tab: 'queue',
      urgent: overview.openCases > 0,
    },
    { label: 'Reports this week', value: overview.reportsThisWeek, icon: Flag, tab: 'queue' },
    { label: 'Suspended accounts', value: overview.suspendedAccounts, icon: Ban, tab: 'people' },
    {
      label: 'Decisions this week',
      value: overview.decisionsThisWeek,
      icon: History,
      tab: 'history',
    },
    { label: 'New accounts this week', value: overview.newAccountsThisWeek, icon: UserCheck },
    { label: 'Posts this week', value: overview.postsThisWeek, icon: ShieldCheck },
  ];

  return (
    <View style={styles.tiles}>
      {tiles.map((tile) => (
        <StatTile
          key={tile.label}
          {...tile}
          onPress={tile.tab ? () => onOpen(tile.tab!) : undefined}
        />
      ))}
    </View>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  urgent,
  onPress,
}: {
  readonly label: string;
  readonly value: number;
  readonly icon: LucideIcon;
  readonly urgent?: boolean;
  readonly onPress?: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const body = (
    <>
      <Icon size={18} strokeWidth={2} color={urgent ? colors.accent : colors.textSecondary} />
      <SWText variant="priceLarge">{String(value)}</SWText>
      <SWText variant="labelSmall" tone="textSecondary">
        {label}
      </SWText>
    </>
  );
  return onPress ? (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      style={[styles.tile, urgent ? styles.tileUrgent : null]}
    >
      {body}
    </PressableScale>
  ) : (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      style={[styles.tile, urgent ? styles.tileUrgent : null]}
    >
      {body}
    </View>
  );
}

// -------------------------------------------------------------------------------------------
// People
// -------------------------------------------------------------------------------------------

function PeopleTab({
  search,
  onSearch,
}: {
  readonly search: string;
  readonly onSearch: (text: string) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const toast = useToast();
  const repository = useAdminRepository();
  const [people, setPeople] = useState<readonly ModeratedPerson[] | null | 'failed'>(null);
  const [suspending, setSuspending] = useState<ModeratedPerson | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    async (term: string) => {
      const result = await repository.people(term);
      setPeople(result.ok ? result.value : 'failed');
    },
    [repository],
  );

  // Looks people up a moment after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => void load(search), 250);
    return () => clearTimeout(timer);
  }, [load, search]);

  const reinstate = async (person: ModeratedPerson) => {
    setBusy(person.id);
    const result = await repository.reinstate(person.id);
    setBusy(null);
    toast.show(
      result.ok
        ? { title: `@${person.handle} reinstated`, body: 'They can post and message again.' }
        : { title: 'Couldn’t reinstate', body: 'Try again in a moment.', tone: 'error' },
    );
    await load(search);
  };

  return (
    <View style={styles.tab}>
      <TextField
        value={search}
        onChangeText={onSearch}
        placeholder="Search by @handle or name"
        autoCapitalize="none"
        autoCorrect={false}
        leading={<Search size={18} strokeWidth={2} color={colors.textMuted} />}
        accessibilityLabel="Search people"
      />
      {!search.trim() ? (
        <SWText variant="caption" tone="textMuted">
          Most reported first.
        </SWText>
      ) : null}
      {people === 'failed' ? (
        <LoadFailed onRetry={() => load(search)} />
      ) : people === null ? null : people.length === 0 ? (
        <EmptyState icon={Search} title="Nobody matches" body="Try part of their handle." />
      ) : (
        people.map((person) => (
          <PersonCard
            key={person.id}
            person={person}
            busy={busy === person.id}
            onSuspend={() => setSuspending(person)}
            onReinstate={() => void reinstate(person)}
          />
        ))
      )}
      <SuspendSheet
        person={suspending}
        onClose={() => setSuspending(null)}
        onSuspend={async (input) => {
          if (!suspending) return;
          const target = suspending;
          const result = await repository.suspend(target.id, input);
          setSuspending(null);
          toast.show(
            result.ok
              ? {
                  title: `@${target.handle} suspended`,
                  body: input.takeDown
                    ? 'Their posts, comments and listings were taken down.'
                    : 'They can look around but can’t post or message.',
                }
              : { title: 'Couldn’t suspend', body: 'Try again in a moment.', tone: 'error' },
          );
          await load(search);
        }}
      />
    </View>
  );
}

function PersonCard({
  person,
  busy,
  onSuspend,
  onReinstate,
}: {
  readonly person: ModeratedPerson;
  readonly busy: boolean;
  readonly onSuspend: () => void;
  readonly onReinstate: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const openPerson = useOpenPerson();
  const name = person.displayName ?? `@${person.handle}`;
  return (
    <Surface padding={tokens.spacing[4]} contentStyle={styles.card}>
      <View style={styles.personRow}>
        <Avatar
          source={person.avatarUrl ? { uri: person.avatarUrl } : null}
          name={name}
          size={44}
        />
        <View style={styles.flex}>
          <SWText variant="headingSmall">{name}</SWText>
          <SWText variant="caption" tone="textMuted">
            {`@${person.handle} · joined ${ageLabel(person.joinedAt)}`}
          </SWText>
        </View>
        {person.isAdmin ? <Tag label="Moderator" tone="mint" icon={ShieldCheck} /> : null}
        {person.suspended ? <Tag label="Suspended" tone="danger" icon={Ban} /> : null}
      </View>

      <View style={styles.counts}>
        <Count value={person.postCount} label="posts" />
        <Count value={person.commentCount} label="comments" />
        <Count value={person.listingCount} label="listings" />
        <Count value={person.reportsAgainst} label="reports" warn={person.reportsAgainst > 0} />
        <Count value={person.removedCount} label="taken down" warn={person.removedCount > 0} />
      </View>

      {person.suspended ? (
        <SWText variant="bodySmall" tone="textSecondary">
          {`${person.suspendedUntil ? `Until ${new Date(person.suspendedUntil).toLocaleDateString()}` : 'Until lifted'}: ${person.suspensionReason ?? ''}`}
        </SWText>
      ) : null}

      <View style={styles.actions}>
        {openPerson ? (
          <Button
            label="Profile"
            variant="tertiary"
            size="small"
            onPress={() => openPerson(person.handle)}
          />
        ) : null}
        {person.isAdmin ? null : person.suspended ? (
          <Button
            label="Reinstate"
            variant="secondary"
            size="small"
            icon={RotateCcw}
            disabled={busy}
            onPress={onReinstate}
          />
        ) : (
          <Button
            label="Suspend…"
            variant="danger"
            size="small"
            icon={Ban}
            disabled={busy}
            onPress={onSuspend}
          />
        )}
      </View>
    </Surface>
  );
}

function Count({
  value,
  label,
  warn,
}: {
  readonly value: number;
  readonly label: string;
  readonly warn?: boolean;
}) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={styles.count}>
      <SWText variant="headingSmall" tone={warn ? 'warning' : undefined}>
        {String(value)}
      </SWText>
      <SWText variant="caption" tone="textMuted">
        {label}
      </SWText>
    </View>
  );
}

const reasons = [
  { key: 'Spam or scams', label: 'Spam or scams' },
  { key: 'Harassment', label: 'Harassment' },
  { key: 'Inappropriate content', label: 'Inappropriate' },
  { key: 'Fake or misleading listings', label: 'Misleading listings' },
  { key: 'Other', label: 'Other' },
] as const;

const lengths = [
  { key: '1', label: '1 day' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: 'lifted', label: 'Until lifted' },
] as const;

function SuspendSheet({
  person,
  onClose,
  onSuspend,
}: {
  readonly person: ModeratedPerson | null;
  readonly onClose: () => void;
  readonly onSuspend: (input: SuspendInput) => Promise<void>;
}) {
  const styles = useThemedStyles(stylesFor);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [length, setLength] = useState<string>('7');
  const [takeDown, setTakeDown] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!person) return;
    setReason(null);
    setNote('');
    setLength('7');
    setTakeDown(false);
  }, [person]);

  const fullReason = [reason, note.trim()].filter(Boolean).join(': ');

  return (
    <Sheet
      visible={person !== null}
      onClose={onClose}
      title={person ? `Suspend @${person.handle}` : undefined}
    >
      <View style={styles.sheet}>
        <SWText variant="bodySmall" tone="textSecondary">
          They can still sign in and look around, but can’t post, comment, list, vote or message
          until it ends.
        </SWText>
        <ChoiceChips label="Why" options={reasons} value={reason} onChange={setReason} />
        <TextField
          value={note}
          onChangeText={setNote}
          placeholder="Anything to add (only moderators see this)"
          maxLength={200}
          accessibilityLabel="Note for other moderators"
        />
        <ChoiceChips label="For how long" options={lengths} value={length} onChange={setLength} />
        <View style={styles.option}>
          <View style={styles.flex}>
            <SWText variant="label">Also take down what they’ve posted</SWText>
            <SWText variant="caption" tone="textMuted">
              Their posts, comments, listings and hanaps stop being public.
            </SWText>
          </View>
          <Toggle
            value={takeDown}
            onValueChange={setTakeDown}
            accessibilityLabel="Also take down what they've posted"
          />
        </View>
        <Button
          label={saving ? 'Suspending…' : 'Suspend account'}
          variant="danger"
          icon={Ban}
          disabled={!reason || saving}
          loading={saving}
          onPress={async () => {
            if (!reason) return;
            setSaving(true);
            await onSuspend({
              reason: fullReason,
              days: length === 'lifted' ? null : Number(length),
              takeDown,
            });
            setSaving(false);
          }}
        />
      </View>
    </Sheet>
  );
}

// -------------------------------------------------------------------------------------------
// History
// -------------------------------------------------------------------------------------------

const decisionCopy: Readonly<
  Record<ModerationEntry['decision'], { readonly verb: string; readonly icon: LucideIcon }>
> = {
  approve: { verb: 'approved', icon: Check },
  hold: { verb: 'held', icon: EyeOff },
  remove: { verb: 'removed', icon: Trash2 },
  dismiss: { verb: 'dismissed reports on', icon: X },
  suspend: { verb: 'suspended', icon: Ban },
  reinstate: { verb: 'reinstated', icon: RotateCcw },
};

function HistoryTab() {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const repository = useAdminRepository();
  const [entries, setEntries] = useState<readonly ModerationEntry[] | null | 'failed'>(null);

  const load = useCallback(async () => {
    const result = await repository.history();
    setEntries(result.ok ? result.value : 'failed');
  }, [repository]);

  useEffect(() => {
    void load();
  }, [load]);

  if (entries === 'failed') return <LoadFailed onRetry={load} />;
  if (!entries) return null;
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nothing decided yet"
        body="Every approval, removal and suspension shows up here, with who made it."
      />
    );
  }
  return (
    <View style={styles.tab}>
      {entries.map((entry) => {
        const copy = decisionCopy[entry.decision];
        const Icon = copy.icon;
        const what =
          entry.kind === 'account'
            ? (entry.targetLabel ?? 'an account')
            : `${kindLabel(entry.kind).toLowerCase()}${entry.targetLabel ? ` “${entry.targetLabel}”` : ''}`;
        return (
          <View key={entry.id} style={styles.entry}>
            <View style={styles.entryIcon}>
              <Icon size={16} strokeWidth={2} color={colors.textSecondary} />
            </View>
            <View style={styles.flex}>
              <SWText variant="bodySmall">{`@${entry.decidedBy} ${copy.verb} ${what}`}</SWText>
              {entry.note ? (
                <SWText variant="caption" tone="textSecondary">
                  {entry.note}
                </SWText>
              ) : null}
              <SWText variant="caption" tone="textMuted">
                {ageLabel(entry.decidedAt)}
              </SWText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function LoadFailed({ onRetry }: { readonly onRetry: () => void | Promise<void> }) {
  return (
    <EmptyState
      icon={WifiOff}
      tone="error"
      title="Couldn’t load this"
      body="Check your connection and try again."
      actionLabel="Retry"
      onAction={() => void onRetry()}
    />
  );
}

const stylesFor = themedStyles((colors) => ({
  content: {
    paddingTop: tokens.spacing[4],
    gap: tokens.spacing[4],
  },
  top: {
    gap: tokens.spacing[1],
  },
  tab: {
    gap: tokens.spacing[3],
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[3],
  },
  tile: {
    flexGrow: 1,
    flexBasis: 200,
    gap: tokens.spacing[1],
    padding: tokens.spacing[4],
    borderRadius: tokens.radius.large,
    backgroundColor: colors.surface,
    ...held(colors, 3),
  },
  tileUrgent: {
    backgroundColor: colors.sand,
  },
  card: {
    gap: tokens.spacing[3],
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    flexWrap: 'wrap',
  },
  flex: {
    flex: 1,
    gap: tokens.spacing[1],
  },
  counts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[5],
  },
  count: {
    alignItems: 'flex-start',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.spacing[2],
  },
  sheet: {
    gap: tokens.spacing[4],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  entry: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
    borderBottomWidth: tokens.border.hairline,
    borderBottomColor: colors.borderSubtle,
  },
  entryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
}));
