import { createContext, useContext, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from './PressableScale';

/**
 * Opening someone's profile from wherever their name or photo appears: a post, a comment, a chat.
 * The app shell supplies how (it owns navigation); without one, names are plain text.
 */
const OpenPersonContext = createContext<((handle: string) => void) | null>(null);

export function PersonLinkProvider({
  onOpen,
  children,
}: {
  readonly onOpen: (handle: string) => void;
  readonly children: ReactNode;
}) {
  return <OpenPersonContext.Provider value={onOpen}>{children}</OpenPersonContext.Provider>;
}

/** Opens a person's profile, or null where there's nowhere to open it. */
export function useOpenPerson(): ((handle: string) => void) | null {
  return useContext(OpenPersonContext);
}

/**
 * A person's name and photo that open their profile. A deleted account (no handle), or an app
 * with no profiles to open, draws the same thing without the press.
 */
export function PersonLink({
  handle,
  label,
  style,
  children,
}: {
  readonly handle: string | null | undefined;
  /** Who it is, for screen readers: "Opens @mariacruz's profile". */
  readonly label?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}) {
  const open = useOpenPerson();
  if (!open || !handle) return <View style={style}>{children}</View>;
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${label ?? `@${handle}`}. Opens their profile`}
      haptic="select"
      onPress={() => open(handle)}
      style={style}
    >
      {children}
    </PressableScale>
  );
}
