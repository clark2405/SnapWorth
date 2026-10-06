import { Camera, Heart, ShoppingBag, Vote, type LucideIcon } from 'lucide-react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { StyleProp, ViewStyle } from 'react-native';

import { TipCard } from '../../components';

/**
 * The few things worth teaching, each where it happens. A tip retires for good once the person
 * does the thing ("learning by doing") or closes it.
 */
export type TipId = 'snap' | 'vote' | 'list' | 'save';

const tipCopy: Record<TipId, { icon: LucideIcon; title: string; message: string }> = {
  snap: {
    icon: Camera,
    title: 'Snap anything',
    message: 'Tap Snap it and photograph something. You get a fair price range in seconds.',
  },
  vote: {
    icon: Vote,
    title: 'Is the price right?',
    message: 'Tap Too high, Just right or Too low. Votes shape the community verdict.',
  },
  list: {
    icon: ShoppingBag,
    title: 'Ready to sell?',
    message: 'List it or ask the community. The range is a guide; you set the price.',
  },
  save: {
    icon: Heart,
    title: 'Keep an eye on it',
    message: 'Tap the heart to save a listing and hear when its price drops.',
  },
};

/** Where retired tips are remembered; the shell supplies device storage. */
export interface TipStore {
  load(): Promise<readonly string[]>;
  save(retired: readonly string[]): Promise<void>;
}

interface TipsContextValue {
  readonly loaded: boolean;
  readonly retired: ReadonlySet<string>;
  readonly retire: (id: TipId) => void;
}

const TipsContext = createContext<TipsContextValue | null>(null);

export function TipsProvider({
  store,
  children,
}: {
  readonly store?: TipStore;
  readonly children: ReactNode;
}) {
  const [retired, setRetired] = useState<ReadonlySet<string>>(new Set());
  // Hold every tip back until we know which are retired, so none flashes up and vanishes.
  const [loaded, setLoaded] = useState(!store);

  useEffect(() => {
    if (!store) return;
    let active = true;
    void store
      .load()
      .catch(() => [])
      .then((ids) => {
        if (!active) return;
        setRetired(new Set(ids));
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [store]);

  const retire = useCallback(
    (id: TipId) =>
      setRetired((current) => {
        if (current.has(id)) return current;
        const next = new Set(current).add(id);
        void store?.save([...next]).catch(() => undefined);
        return next;
      }),
    [store],
  );

  const value = useMemo(() => ({ loaded, retired, retire }), [loaded, retire, retired]);
  return <TipsContext.Provider value={value}>{children}</TipsContext.Provider>;
}

/** `done` retires the tip because the person did the thing it teaches. */
export function useTip(id: TipId) {
  const context = useContext(TipsContext);
  // Outside a provider (tests, previews) tips simply stay quiet.
  const visible = context ? context.loaded && !context.retired.has(id) : false;
  const done = useCallback(() => context?.retire(id), [context, id]);
  return { visible, done };
}

/** The tip itself, shown in place until it is done or closed. */
export function Tip({ id, style }: { readonly id: TipId; readonly style?: StyleProp<ViewStyle> }) {
  const { visible, done } = useTip(id);
  if (!visible) return null;
  const copy = tipCopy[id];
  return (
    <TipCard
      icon={copy.icon}
      title={copy.title}
      message={copy.message}
      onClose={done}
      style={style}
    />
  );
}
