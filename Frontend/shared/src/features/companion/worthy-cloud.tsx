import { createContext, useContext, type ReactNode } from 'react';

import type { WorthyCloud } from '../../ports/worthy';

const WorthyCloudContext = createContext<WorthyCloud | null>(null);

/** Worthy's chat in the cloud, from the composition root; none without a backend. */
export function WorthyCloudProvider({
  cloud,
  children,
}: {
  readonly cloud: WorthyCloud | null;
  readonly children: ReactNode;
}) {
  return <WorthyCloudContext.Provider value={cloud}>{children}</WorthyCloudContext.Provider>;
}

export function useWorthyCloud(): WorthyCloud | null {
  return useContext(WorthyCloudContext);
}
