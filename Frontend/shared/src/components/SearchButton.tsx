import { useIsFocused } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { IconButton } from './IconButton';

/** Where a search button sits on screen, so the search field can grow out of it. */
export interface SearchOrigin {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SearchButtonProps {
  readonly label: string;
  /** Receives the button's frame in window coordinates, or nothing if it cannot be measured. */
  readonly onOpen?: (origin?: SearchOrigin) => void;
}

/**
 * The round search button on tab roots. It hands its own frame to the search screen, whose
 * field starts as this exact circle and stretches out from it. While search is open the button
 * steps aside, so the field is the only one on screen; it is back in place when search folds
 * into it again.
 */
export function SearchButton({ label, onOpen }: SearchButtonProps) {
  const frame = useRef<View>(null);
  const focused = useIsFocusedSafe();
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    if (focused) setLaunched(false);
  }, [focused]);

  const open = () => {
    setLaunched(true);
    const node = frame.current;
    if (!node) {
      onOpen?.();
      return;
    }
    node.measureInWindow((x, y, width, height) =>
      onOpen?.(width > 0 ? { x, y, width, height } : undefined),
    );
  };

  return (
    <View ref={frame} collapsable={false} style={{ opacity: launched ? 0 : 1 }}>
      <IconButton icon={Search} label={label} appearance="tinted" haptic="tap" onPress={open} />
    </View>
  );
}

/** Focus is only known inside a navigator; elsewhere (tests, previews) treat it as focused. */
function useIsFocusedSafe(): boolean {
  try {
    return useIsFocused();
  } catch {
    return true;
  }
}

/** Carries an origin through a route param, e.g. `?from=304,103,44,44`. */
export function formatSearchOrigin(origin: SearchOrigin): string {
  return [origin.x, origin.y, origin.width, origin.height].map((n) => Math.round(n)).join(',');
}

export function parseSearchOrigin(value: string | undefined): SearchOrigin | undefined {
  const parts = value?.split(',').map(Number);
  if (!parts || parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined;
  const [x = 0, y = 0, width = 0, height = 0] = parts;
  return width > 0 && height > 0 ? { x, y, width, height } : undefined;
}
