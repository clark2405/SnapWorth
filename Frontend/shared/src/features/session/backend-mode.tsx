import { createContext, useContext, type ReactNode } from 'react';

/**
 * Where the app's data lives. `supabase`: a project is configured, so every screen shows that
 * account's real data, and anything the project can't supply is hidden or says it's empty. `device`:
 * no project, so the app runs alone on this device and shows its sample content, which is how the
 * app is tried out and demoed. Sample content never shows in `supabase` mode.
 */
export type BackendMode = 'supabase' | 'device';

const BackendModeContext = createContext<BackendMode>('device');

/** Supplied by the composition root from the services it chose. */
export function BackendModeProvider({
  mode,
  children,
}: {
  readonly mode: BackendMode;
  readonly children: ReactNode;
}) {
  return <BackendModeContext.Provider value={mode}>{children}</BackendModeContext.Provider>;
}

/** Whether the app is running on a Supabase project or alone on the device. Defaults to the device. */
export function useBackendMode(): BackendMode {
  return useContext(BackendModeContext);
}
