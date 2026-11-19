import { createContext, useContext, type ReactNode } from 'react';

/**
 * The website is the moderators' place, not a second copy of the app: there they look at posts,
 * listings, comments and people to judge them, and act in the moderation console. Under
 * `BrowseOnly` the shared screens show what's there but leave out taking part (voting,
 * commenting, buying, selling, posting), which belongs to the phone app.
 */
const BrowseOnlyContext = createContext(false);

export function BrowseOnlyProvider({ children }: { readonly children: ReactNode }) {
  return <BrowseOnlyContext.Provider value>{children}</BrowseOnlyContext.Provider>;
}

/** True where screens are for looking only (the moderators' website). */
export function useBrowseOnly(): boolean {
  return useContext(BrowseOnlyContext);
}
