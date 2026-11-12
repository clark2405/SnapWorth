import { useCallback, useEffect, useRef } from 'react';

import { useSession } from '../session';

/**
 * For the log in and sign up screens, which have nothing to offer someone who already has an
 * account: calls `leave` when the person turns out to be signed in, whether that was true on
 * arrival or the saved session is only restored a moment later.
 *
 * Signing in on the screen itself also makes the person a member, and the screen already knows
 * where to go next (back to what they were doing, or the Feed). So wrap each way of signing in
 * with the returned function: once the person has tried one, `leave` stays out of the way.
 */
export function useLeaveWhenSignedIn(leave: () => void) {
  const { status } = useSession();
  const triedHere = useRef(false);
  const latestLeave = useRef(leave);
  latestLeave.current = leave;

  useEffect(() => {
    if (status === 'member' && !triedHere.current) latestLeave.current();
  }, [status]);

  return useCallback(
    <Args extends unknown[], Result>(attempt: (...args: Args) => Result) =>
      (...args: Args): Result => {
        triedHere.current = true;
        return attempt(...args);
      },
    [],
  );
}
