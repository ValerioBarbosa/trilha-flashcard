import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { AuthStore, type AuthStoreSnapshot } from '@core/features/auth/auth-store';
import { getSupabaseClient } from '../lib/supabase-client';

export type AuthContextValue = AuthStoreSnapshot & {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<User>;
};

const FALLBACK_SNAPSHOT: AuthStoreSnapshot = {
  user: null,
  loading: false,
  initialized: true,
  error: 'supabase-not-configured',
};

const AuthContext = createContext<AuthContextValue | null>(null);

const noopSubscribe = () => () => undefined;

export function AuthProvider({ children }: PropsWithChildren) {
  const [{ store, setupError }] = useState(() => {
    try {
      return { store: new AuthStore(getSupabaseClient()), setupError: null as string | null };
    } catch (error) {
      return {
        store: null,
        setupError: error instanceof Error ? error.message : String(error),
      };
    }
  });

  useEffect(() => {
    store?.start();
    return () => store?.stop();
  }, [store]);

  const snapshot = useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? (() => ({ ...FALLBACK_SNAPSHOT, error: setupError })),
    store?.getSnapshot ?? (() => ({ ...FALLBACK_SNAPSHOT, error: setupError })),
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...snapshot,
      signIn: async () => {
        if (!store) throw new Error(setupError ?? 'supabase-not-configured');
        await store.signIn();
      },
      signOut: async () => {
        if (!store) throw new Error(setupError ?? 'supabase-not-configured');
        await store.signOut();
      },
      refresh: async () => {
        if (!store) throw new Error(setupError ?? 'supabase-not-configured');
        return store.refresh();
      },
    }),
    [setupError, snapshot, store],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
