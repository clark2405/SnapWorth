import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { Coordinates, DeviceLocationPort } from '../../ports/location';

/**
 * Where the viewer's position stands. `idle` means nobody has asked yet: the app asks only when
 * someone picks "Near me", never at launch.
 */
export type ViewerLocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

export interface ViewerLocation {
  readonly status: ViewerLocationStatus;
  /** Only while `granted`. Kept in memory for this session; never stored or sent. */
  readonly position: Coordinates | null;
  /** Asks permission (the first time) and reads the position. */
  readonly request: () => Promise<void>;
}

const unavailable: ViewerLocation = {
  status: 'unavailable',
  position: null,
  request: async () => undefined,
};

const ViewerLocationContext = createContext<ViewerLocation | null>(null);

/** Supplied by the composition root so every screen shares one position and one permission ask. */
export function ViewerLocationProvider({
  port,
  children,
}: {
  readonly port: DeviceLocationPort;
  readonly children: ReactNode;
}) {
  const [status, setStatus] = useState<ViewerLocationStatus>('idle');
  const [position, setPosition] = useState<Coordinates | null>(null);
  const inFlight = useRef(false);

  const request = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus('locating');
    try {
      const result = await port.current();
      setPosition(result.status === 'granted' ? result.position : null);
      setStatus(result.status);
    } finally {
      inFlight.current = false;
    }
  }, [port]);

  const value = useMemo(() => ({ status, position, request }), [position, request, status]);
  return <ViewerLocationContext.Provider value={value}>{children}</ViewerLocationContext.Provider>;
}

/** The viewer's position. Outside a provider (a unit test) there is no location service. */
export function useViewerLocation(): ViewerLocation {
  return useContext(ViewerLocationContext) ?? unavailable;
}
