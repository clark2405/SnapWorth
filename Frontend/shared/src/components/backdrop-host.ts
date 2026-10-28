import { createContext } from 'react';

/**
 * Set where one shared backdrop is drawn behind a group of screens (the web's tabs). Those
 * screens draw no backdrop of their own and keep a clear page; they only say which look they
 * want while they're in view, and the shared one changes into it.
 */
export const BackdropHostContext = createContext(false);

/** Called once by a screen when it has been drawn, so a skeleton waiting beneath can leave. */
export const ScreenPresenceContext = createContext<(() => void) | null>(null);
