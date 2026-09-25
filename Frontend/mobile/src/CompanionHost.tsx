import { usePathname, useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';

import { Companion, useToast } from '@snapworth/shared/components';
import { companionConfigFor } from '@snapworth/shared/features/companion';

/** Room above the bottom edge for the floating native tab bar, or a screen's action bar. */
const liftRoom = { tabBar: 70, actionBar: 92 } as const;

/** Mounts Worthy over every screen and feeds it the actions for the current route. */
export function CompanionHost({ ready }: { readonly ready: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const config = useMemo(
    () =>
      companionConfigFor(pathname, {
        go: (href) => router.push(href as Href),
        ask: (question) => router.push({ pathname: '/worthy', params: { q: question } }),
        notify: (title, body) => toast.show({ title, body }),
      }),
    [pathname, router, toast],
  );

  return (
    <Companion
      actions={config.actions}
      greeting={config.greeting}
      hint={config.hint}
      hidden={!ready || config.hidden}
      bottomOffset={liftRoom[config.lift]}
      onAsk={(question) => router.push({ pathname: '/worthy', params: { q: question } })}
      onHoldSnap={() => router.navigate('/capture')}
    />
  );
}
