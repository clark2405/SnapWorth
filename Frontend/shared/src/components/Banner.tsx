import { ChevronRight, MessageCircle, type LucideIcon } from 'lucide-react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOutUp, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import { GlassSurface } from './GlassSurface';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

export interface BannerMessage {
  /** The same id again replaces the banner on screen instead of stacking a second. */
  readonly id: string;
  readonly title: string;
  readonly body?: string;
  readonly icon?: LucideIcon;
  /** Tapping the banner does this, and dismisses it. */
  readonly onPress?: () => void;
}

interface BannerApi {
  readonly show: (message: BannerMessage) => void;
  readonly dismiss: (id?: string) => void;
}

const BannerContext = createContext<BannerApi>({ show: () => undefined, dismiss: () => undefined });

export function useBanner(): BannerApi {
  return useContext(BannerContext);
}

/** How long a banner stays before it lifts away on its own. */
const bannerMs = 6000;

/**
 * Something that happened elsewhere while the app is open ("Maria sent you a message"): a glass
 * pill that drops from the top and can be tapped to go there. Unlike a toast, which confirms what
 * you just did, a banner is about someone else and does something when pressed. One shows at a
 * time; a newer one replaces it.
 */
export function BannerProvider({ children }: { readonly children: ReactNode }) {
  const [current, setCurrent] = useState<(BannerMessage & { key: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const dismiss = useCallback((id?: string) => {
    setCurrent((showing) => (showing && (id === undefined || showing.id === id) ? null : showing));
  }, []);

  const show = useCallback((message: BannerMessage) => {
    counter.current += 1;
    setCurrent({ ...message, key: counter.current });
    haptic('tap');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCurrent(null), bannerMs);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const api = useMemo(() => ({ show, dismiss }), [dismiss, show]);

  return (
    <BannerContext.Provider value={api}>
      {children}
      <View style={styles.host}>
        {current ? (
          <BannerPill
            key={current.key}
            message={current}
            onPress={() => {
              setCurrent(null);
              current.onPress?.();
            }}
          />
        ) : null}
      </View>
    </BannerContext.Provider>
  );
}

function BannerPill({
  message,
  onPress,
}: {
  readonly message: BannerMessage;
  readonly onPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const themed = useThemedStyles(stylesFor);
  const Icon = message.icon ?? MessageCircle;

  return (
    <Animated.View
      entering={SlideInUp.duration(380)}
      exiting={FadeOutUp.duration(220)}
      style={[themed.wrap, { top: insets.top + tokens.spacing[2] }]}
      accessibilityLiveRegion="polite"
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={message.body ? `${message.title}. ${message.body}` : message.title}
        accessibilityHint="Opens it"
        onPress={onPress}
        depth="surface"
      >
        <GlassSurface style={themed.pill} interactive>
          <View style={themed.row}>
            <Icon size={20} strokeWidth={2.2} color={colors.accent} />
            <View style={themed.text}>
              <SWText variant="headingSmall" numberOfLines={1}>
                {message.title}
              </SWText>
              {message.body ? (
                <SWText variant="caption" tone="textSecondary" numberOfLines={2}>
                  {message.body}
                </SWText>
              ) : null}
            </View>
            {message.onPress ? (
              <ChevronRight size={18} strokeWidth={2.2} color={colors.textMuted} />
            ) : null}
          </View>
        </GlassSurface>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'box-none',
  },
});

const stylesFor = themedStyles((_colors, name) => ({
  wrap: {
    position: 'absolute',
    alignSelf: 'center',
    width: tokens.layout.phoneColumn - tokens.spacing[8],
    maxWidth: '92%',
    shadowColor: tokens.shadow[name],
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  pill: {
    borderRadius: tokens.radius.xlarge,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
    paddingLeft: tokens.spacing[4],
    paddingRight: tokens.spacing[4],
  },
  text: {
    flexShrink: 1,
    flexGrow: 1,
  },
}));
