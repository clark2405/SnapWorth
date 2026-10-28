import { LoginView } from '@snapworth/shared/features/auth';

import { useSignIn } from '../../src/use-sign-in';

export default function SignupRoute() {
  const signIn = useSignIn();
  return (
    <LoginView
      initialMode="signup"
      onSubmit={signIn.submit}
      onForgotPassword={signIn.forgotPassword}
      onContinueWithApple={signIn.apple}
      onContinueWithGoogle={signIn.google}
      onClose={signIn.close}
    />
  );
}
