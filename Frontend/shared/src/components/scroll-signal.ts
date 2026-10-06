import { makeMutable } from 'react-native-reanimated';

/**
 * 0 at rest, rising to 1 while the reader scrolls on into new content. Floating chrome (the
 * companion orb) reads it to step out of the way while content moves, then return when the
 * page settles. Written by `Screen`, on the UI thread only.
 */
export const contentScrolling = makeMutable(0);
