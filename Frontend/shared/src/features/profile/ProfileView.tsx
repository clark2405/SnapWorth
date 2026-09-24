import {
  Bell,
  ChevronRight,
  CircleHelp,
  FileText,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  UserPen,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  Button,
  Divider,
  NavHeader,
  PressableScale,
  Reveal,
  Screen,
  Surface,
  SWText,
} from '../../components';
import { tokens } from '../../design';
import { previewHeldContent, previewProfile } from '../preview/sample-data';

export type ProfileDestination =
  'edit-profile' | 'notifications' | 'privacy' | 'moderation' | 'help' | 'terms';

export interface ProfileViewProps {
  readonly onBack?: () => void;
  readonly onOpen?: (destination: ProfileDestination) => void;
  readonly onLogOut?: () => void;
}

interface Row {
  readonly key: ProfileDestination;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly value?: string;
}

const accountRows: readonly Row[] = [
  { key: 'edit-profile', label: 'Edit profile', icon: UserPen },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'privacy', label: 'Privacy and blocked users', icon: ShieldCheck },
];

const supportRows: readonly Row[] = [
  { key: 'help', label: 'Help and feedback', icon: CircleHelp },
  { key: 'terms', label: 'Terms and privacy policy', icon: FileText },
];

export function ProfileView({ onBack, onOpen, onLogOut }: ProfileViewProps) {
  const profile = previewProfile;
  const stats = [
    { label: 'Checked', value: profile.stats.checked },
    { label: 'Listed', value: profile.stats.listed },
    { label: 'Sold', value: profile.stats.sold },
  ];
  const moderationRows: readonly Row[] = profile.isAdmin
    ? [
        {
          key: 'moderation',
          label: 'Review held content',
          icon: ShieldAlert,
          value: String(previewHeldContent.length),
        },
      ]
    : [];

  return (
    <Screen header={<NavHeader title="Profile" onBack={onBack} />} contentStyle={styles.content}>
      <Reveal index={0} style={styles.identity}>
        <Avatar source={profile.user.avatar} name={profile.user.handle} size={72} />
        <View style={styles.identityText}>
          <SWText variant="headingLarge" accessibilityRole="header">
            {profile.displayName}
          </SWText>
          <SWText variant="bodySmall" tone="textSecondary">
            @{profile.user.handle} · ★ {profile.rating}
          </SWText>
          <SWText variant="caption" tone="textMuted">
            {profile.location} · {profile.joined}
          </SWText>
        </View>
      </Reveal>

      <Reveal index={1} style={styles.stats}>
        {stats.map((stat, index) => (
          <View
            key={stat.label}
            accessible
            accessibilityLabel={`${stat.value} ${stat.label.toLowerCase()}`}
            style={[styles.stat, index > 0 ? styles.statRule : null]}
          >
            <SWText variant="priceLarge">{String(stat.value)}</SWText>
            <SWText variant="overline" tone="textMuted">
              {stat.label}
            </SWText>
          </View>
        ))}
      </Reveal>

      <Reveal index={2} style={styles.sections}>
        <Section title="Account" rows={accountRows} onOpen={onOpen} />
        {moderationRows.length > 0 ? (
          <Section title="Moderation" rows={moderationRows} onOpen={onOpen} />
        ) : null}
        <Section title="Support" rows={supportRows} onOpen={onOpen} />
        <Button label="Log out" variant="secondary" icon={LogOut} onPress={onLogOut} />
      </Reveal>
    </Screen>
  );
}

function Section({
  title,
  rows,
  onOpen,
}: {
  title: string;
  rows: readonly Row[];
  onOpen?: (destination: ProfileDestination) => void;
}) {
  return (
    <View style={styles.section}>
      <SWText variant="overline" tone="textMuted" accessibilityRole="header">
        {title}
      </SWText>
      <Surface>
        {rows.map((row, index) => {
          const Icon = row.icon;
          return (
            <View key={row.key}>
              {index > 0 ? <Divider style={styles.rowDivider} /> : null}
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={row.value ? `${row.label}, ${row.value}` : row.label}
                onPress={() => onOpen?.(row.key)}
                style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
              >
                <Icon size={20} strokeWidth={1.75} color={tokens.color.dark.textSecondary} />
                <SWText variant="bodyMedium" style={styles.rowLabel}>
                  {row.label}
                </SWText>
                {row.value ? (
                  <View style={styles.count}>
                    <SWText variant="labelSmall" tone="warning">
                      {row.value}
                    </SWText>
                  </View>
                ) : null}
                <ChevronRight size={18} strokeWidth={2} color={tokens.color.dark.textMuted} />
              </PressableScale>
            </View>
          );
        })}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderColor: tokens.color.dark.borderSubtle,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: tokens.spacing[1],
  },
  statRule: {
    borderLeftWidth: tokens.border.hairline,
    borderLeftColor: tokens.color.dark.borderSubtle,
  },
  sections: {
    gap: tokens.spacing[6],
  },
  section: {
    gap: tokens.spacing[2],
  },
  row: {
    minHeight: tokens.layout.controlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
  },
  rowPressed: {
    backgroundColor: tokens.color.dark.surfaceRaised,
  },
  rowLabel: {
    flex: 1,
  },
  rowDivider: {
    marginLeft: tokens.spacing[4] + tokens.spacing[5] + tokens.spacing[3],
  },
  count: {
    paddingHorizontal: tokens.spacing[2],
    borderRadius: tokens.radius.full,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.warning,
  },
});
