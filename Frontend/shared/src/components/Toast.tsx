import { CircleCheck, type LucideIcon } from 'lucide-react-native';
import {
  createContext,
  useCallback,
  useContext,
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
import { SWText } from './SWText';

export interface ToastMessage {
  readonly title: string;
  readonly body?: string;
  readonly icon?: LucideIcon;
}

interface ToastApi {
  readonly show: (message: ToastMessage) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

/**
 * Confirmation that an action landed ("Offer sent", "Alert set"): a glass pill that drops from
 * the top on a spring with a success haptic, then lifts away. It never blocks the screen.
 */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [current, setCurrent] = useState<(ToastMessage & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const show = useCallback((message: ToastMessage) => {
    counter.current += 1;
    setCurrent({ ...message, id: counter.current });
    haptic('success');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCurrent(null), 2400);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View style={styles.host}>
        {current ? <ToastPill key={current.id} message={current} /> : null}
      </View>
    </ToastContext.Provider>
  );
}

function ToastPill({ message }: { readonly message: ToastMessage }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const themed = useThemedStyles(stylesFor);
  const Icon = message.icon ?? CircleCheck;

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(18).stiffness(220)}
      exiting={FadeOutUp.duration(220)}
      style={[themed.wrap, { top: insets.top + tokens.spacing[2] }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <GlassSurface style={themed.pill}>
        <View style={themed.row}>
          <Icon size={20} strokeWidth={2.2} color={colors.success} />
          <View style={themed.text}>
            <SWText variant="headingSmall">{message.title}</SWText>
            {message.body ? (
              <SWText variant="caption" tone="textSecondary">
                {message.body}
              </SWText>
            ) : null}
          </View>
        </View>
      </GlassSurface>
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
    maxWidth: tokens.layout.phoneColumn - tokens.spacing[8],
    shadowColor: tokens.shadow[name],
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  pill: {
    borderRadius: tokens.radius.full,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
    paddingLeft: tokens.spacing[4],
    paddingRight: tokens.spacing[5],
  },
  text: {
    flexShrink: 1,
  },
}));
