import {
  Bell,
  ChevronRight,
  CircleHelp,
  LogOut,
  ShieldAlert,
  TrendingDown,
} from 'lucide-react-native';
import { View } from 'react-native';

import {
  Avatar,
  CountUp,
  ListGroup,
  ListRow,
  NavHeader,
  PressableScale,
  Reveal,
  Screen,
  SegmentedControl,
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
  previewProfile,
} from '../preview/sample-data';

export type ProfileDestination =
  'edit-profile' | 'notifications' | 'price-alerts' | 'privacy' | 'moderation' | 'help' | 'terms';

export interface ProfileViewProps {
  readonly onBack?: () => void;
  readonly onOpen?: (destination: ProfileDestination) => void;
  readonly onLogOut?: () => void;
}

const appearanceOptions: readonly { readonly key: ThemePreference; readonly label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export function ProfileView({ onBack, onOpen, onLogOut }: ProfileViewProps) {
  const { colors, preference, setPreference } = useTheme();
  const styles = useThemedStyles(stylesFor);
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
            <SWText variant="bodySmall" tone="textSecondary">
              @{profile.user.handle} · ★ {profile.rating}
            </SWText>
            <SWText variant="caption" tone="textMuted">
              {profile.location} · {profile.joined}
            </SWText>
          </View>
          <ChevronRight size={18} strokeWidth={2} color={colors.textMuted} />
        </PressableScale>
      </Reveal>

      <Reveal index={1} style={styles.stats}>
        {stats.map((stat, index) => (
          <View
            key={stat.label}
            accessible
            accessibilityLabel={`${stat.value} ${stat.label.toLowerCase()}`}
            style={[styles.stat, index > 0 ? styles.statRule : null]}
          >
            <CountUp
              value={stat.value}
              format={(value) => String(Math.round(value))}
              variant="priceLarge"
            />
            <SWText variant="overline" tone="textMuted">
              {stat.label}
            </SWText>
          </View>
        ))}
      </Reveal>

      <Reveal index={2}>
        <Surface padding={tokens.spacing[4]} contentStyle={styles.collectionCard}>
          <View style={styles.collectionHeader}>
            <SWText variant="overline" tone="textMuted">
              Collection value
            </SWText>
            <Tag label={previewPortfolio.changeLabel} tone="success" />
          </View>
          <CountUp value={previewPortfolio.total} format={formatPeso} variant="priceLarge" />
          <Sparkline values={previewPortfolio.series} height={56} />
        </Surface>
      </Reveal>

      <Reveal index={3} style={styles.sections}>
        <ListGroup title="Appearance">
          <View style={styles.appearanceRow}>
            <SegmentedControl
              options={appearanceOptions}
              value={preference}
              onChange={setPreference}
            />
          </View>
        </ListGroup>

        <ListGroup title="Settings">
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
        </ListGroup>

        <ListGroup>
          <ListRow label="Log out" icon={LogOut} destructive onPress={onLogOut} />
        </ListGroup>
      </Reveal>
    </Screen>
  );
}

const stylesFor = themedStyles((colors) => ({
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
  stats: {
    flexDirection: 'row',
    paddingVertical: tokens.spacing[4],
    borderTopWidth: tokens.border.hairline,
    borderBottomWidth: tokens.border.hairline,
    borderColor: colors.borderSubtle,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: tokens.spacing[1],
  },
  statRule: {
    borderLeftWidth: tokens.border.hairline,
    borderLeftColor: colors.borderSubtle,
  },
  collectionCard: {
    gap: tokens.spacing[3],
  },
  collectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sections: {
    gap: tokens.spacing[6],
  },
  appearanceRow: {
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
  },
}));
