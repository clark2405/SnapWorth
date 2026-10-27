import { MessageSquare, UserRound, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import {
  Button,
  EmptyState,
  HistoryIcon,
  LargeTitle,
  NavHeader,
  PlacePanel,
  Reveal,
  Screen,
  SnapIcon,
  SWText,
  TagShape,
  Worthy,
} from '../../components';
import {
  placeColors,
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  type Place,
} from '../../design';
import { accountIntentCopy, useSession, type AccountIntent } from './session';

type GatedScreen = Extract<AccountIntent, 'snap' | 'chats' | 'history' | 'profile'>;

const icons: Record<GatedScreen, LucideIcon> = {
  snap: SnapIcon,
  chats: MessageSquare,
  history: HistoryIcon,
  profile: UserRound,
};

/** The tabs a guest can open, and the place each one opens on. */
const places: Partial<Record<GatedScreen, Place>> = {
  chats: 'chat',
  history: 'history',
};

interface PileTag {
  readonly label: string;
  readonly price: string;
}

/** What will live here once there is an account, as a little pile of tags around Worthy. */
const piles: Partial<Record<GatedScreen, readonly PileTag[]>> = {
  history: [
    { label: 'Walkman', price: '₱1,800' },
    { label: 'Polaroid', price: '₱3,000' },
    { label: 'Jordan 1', price: '₱10,030' },
  ],
  chats: [
    { label: 'Offer', price: '₱2,300' },
    { label: 'Asking', price: '₱3,200' },
    { label: 'Sold', price: '₱1,950' },
  ],
};

export interface AccountGateViewProps {
  /** The screen's own name, so a guest still knows where they are. */
  readonly title: string;
  readonly intent: GatedScreen;
  /** A pushed screen has a way back; a tab does not. */
  readonly onBack?: () => void;
}

/**
 * What a guest sees on a screen that only makes sense with an account: the screen keeps its
 * name, says plainly what it is for, and offers a way in without forcing one. A tab shows it as
 * one scene in its own colour, Worthy among the tags that will live there.
 */
export function AccountGateView({ title, intent, onBack }: AccountGateViewProps) {
  const styles = useThemedStyles(stylesFor);
  const { createAccount, signIn } = useSession();
  const copy = accountIntentCopy[intent];
  const place = onBack ? undefined : places[intent];
  const pile = piles[intent];

  if (place && pile) {
    return (
      <Screen clearTabBar place={place} ambient={place} quiet>
        <LargeTitle brand title={title} />
        <GuestScene place={place} pile={pile} title={copy.title} body={copy.body}>
          <Button label="Create free account" onPress={createAccount} />
          <Button label="I have an account" variant="secondary" onPress={signIn} />
        </GuestScene>
      </Screen>
    );
  }

  return (
    <Screen
      quiet
      clearTabBar={!onBack}
      header={onBack ? <NavHeader title={title} onBack={onBack} /> : undefined}
    >
      {onBack ? null : <LargeTitle brand title={title} />}
      <EmptyState icon={icons[intent]} title={copy.title} body={copy.body} />
      <Reveal index={1} style={styles.actions}>
        <Button label="Create free account" onPress={createAccount} />
        <Button label="I have an account" variant="secondary" onPress={signIn} />
      </Reveal>
    </Screen>
  );
}

function GuestScene({
  place,
  pile,
  title,
  body,
  children,
}: {
  readonly place: Place;
  readonly pile: readonly PileTag[];
  readonly title: string;
  readonly body: string;
  readonly children: ReactNode;
}) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const ink = placeColors(colors, place).ink;
  return (
    <PlacePanel style={styles.scene}>
      {/* Worthy on the left, the tags in a stepped column on the right: laid out in flow rather
          than pinned, so no tag can land on another or on Worthy whatever its price's width.
          They all sit on the end side, so they all lean the end side's way. */}
      <Reveal index={1} style={styles.pile}>
        <Worthy size={88} mood="attentive" />
        <View
          style={styles.tags}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {pile.map((tag, index) => (
            <TagShape
              key={tag.label}
              tilt={tokens.tilt.end}
              style={[styles.tag, index % 2 === 1 ? styles.tagStep : null]}
            >
              <SWText variant="stamp" color={colors.kraftInk}>
                {tag.label}
              </SWText>
              <SWText variant="priceMedium" color={colors.kraftInk}>
                {tag.price}
              </SWText>
            </TagShape>
          ))}
        </View>
      </Reveal>
      <Reveal index={2} style={styles.copy}>
        <SWText variant="headingLarge" align="center" color={ink} accessibilityRole="header">
          {title}
        </SWText>
        <SWText variant="bodyMedium" align="center" color={ink}>
          {body}
        </SWText>
      </Reveal>
      <Reveal index={3} style={styles.actions}>
        {children}
      </Reveal>
    </PlacePanel>
  );
}

const stylesFor = themedStyles(() => ({
  actions: {
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[4],
    // Buttons a hand's width across, however wide the window: a full-width bar reads as a banner.
    width: '100%',
    maxWidth: tokens.layout.phoneColumn,
    alignSelf: 'center',
  },
  scene: {
    gap: tokens.spacing[5],
  },
  pile: {
    marginTop: tokens.spacing[4],
    marginBottom: tokens.spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[6],
  },
  tags: {
    alignItems: 'flex-start',
    gap: tokens.spacing[3],
  },
  tag: {
    paddingVertical: tokens.spacing[2],
    paddingRight: tokens.spacing[4],
  },
  // The middle tag steps in, so the column reads as a little stack rather than a list.
  tagStep: {
    marginLeft: tokens.spacing[6],
  },
  copy: {
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[4],
  },
}));
