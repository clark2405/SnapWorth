import { act } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { useSession } from '../session';
import { useLeaveWhenSignedIn } from './use-leave-when-signed-in';

interface Handle {
  session: ReturnType<typeof useSession>;
  signingIn: ReturnType<typeof useLeaveWhenSignedIn>;
}

/** Mounts the hook under the same providers a screen has, and hands back what it returns. */
function setup(leave: () => void) {
  const handle = {} as Handle;
  function Probe() {
    handle.session = useSession();
    handle.signingIn = useLeaveWhenSignedIn(leave);
    return null;
  }
  renderScreen(<Probe />);
  return handle;
}

describe('useLeaveWhenSignedIn', () => {
  it('leaves nobody alone who is only looking around', () => {
    const leave = jest.fn();
    setup(leave);

    expect(leave).not.toHaveBeenCalled();
  });

  it('sends a signed-in person away, however late their saved session arrives', () => {
    const leave = jest.fn();
    const handle = setup(leave);

    act(() => handle.session.startSession({ id: 'usr_1' }));

    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('stays out of the way of a sign-in made on the screen itself', async () => {
    const leave = jest.fn();
    const handle = setup(leave);
    const submit = jest.fn(async () => {
      handle.session.startSession({ id: 'usr_1' });
    });

    await act(async () => {
      await handle.signingIn(submit)();
    });

    expect(submit).toHaveBeenCalledTimes(1);
    expect(leave).not.toHaveBeenCalled();
  });

  it('passes the wrapped function’s arguments and answer through', () => {
    const handle = setup(jest.fn());

    expect(handle.signingIn((a: number, b: number) => a + b)(2, 3)).toBe(5);
  });
});
