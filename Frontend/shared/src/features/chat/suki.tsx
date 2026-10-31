import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import type { SukiRepository } from '../../ports/suki';
import { ok } from '../../types/result';

const SukiContext = createContext<SukiRepository | null>(null);

/** Supplied once by the app's composition root, beside the chats. */
export function SukiProvider({
  repository,
  children,
}: {
  readonly repository: SukiRepository;
  readonly children: ReactNode;
}) {
  return <SukiContext.Provider value={repository}>{children}</SukiContext.Provider>;
}

/** Without a provider (a screen rendered on its own, as in tests) nobody is anyone's suki. */
const nobody: SukiRepository = {
  discountWith: () => Promise.resolve(ok(null)),
  set: () => Promise.resolve(ok(undefined)),
};

/** The suki discount in one chat, and, for the seller, a way to set it. */
export function useSuki(
  chat: { readonly otherUserId: string; readonly iAmSeller: boolean } | null,
) {
  const repository = useContext(SukiContext) ?? nobody;
  const [discountPct, setDiscountPct] = useState<number | null>(null);
  const other = chat?.otherUserId;
  const iAmSeller = chat?.iAmSeller ?? false;

  useEffect(() => {
    if (!other) return;
    let active = true;
    void repository.discountWith(other, iAmSeller).then((result) => {
      if (active && result.ok) setDiscountPct(result.value);
    });
    return () => {
      active = false;
    };
  }, [iAmSeller, other, repository]);

  const set = useCallback(
    async (pct: number | null) => {
      if (!other || !iAmSeller) return false;
      const result = await repository.set(other, pct);
      if (result.ok) setDiscountPct(pct);
      return result.ok;
    },
    [iAmSeller, other, repository],
  );

  return { discountPct, set };
}

/** The suki price of something: the asking price less the discount, to the nearest ₱10. */
export function sukiPrice(askingPrice: number, discountPct: number): number {
  return Math.round((askingPrice * (100 - discountPct)) / 100 / 10) * 10;
}
