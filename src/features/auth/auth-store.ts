import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  observeAuthUser,
  refreshSession,
  signInWithGoogle,
  signOut,
  type AuthState,
} from '../../infrastructure/supabase/auth';

export type AuthStoreSnapshot = AuthState & {
  initialized: boolean;
  error: string | null;
};

export type AuthStoreListener = (snapshot: AuthStoreSnapshot) => void;

const INITIAL_STATE: AuthStoreSnapshot = {
  user: null,
  loading: true,
  initialized: false,
  error: null,
};

export class AuthStore {
  private snapshot: AuthStoreSnapshot = INITIAL_STATE;
  private listeners = new Set<AuthStoreListener>();
  private stopObserving: (() => void) | null = null;

  constructor(private readonly client: SupabaseClient) {}

  getSnapshot = (): AuthStoreSnapshot => this.snapshot;

  subscribe = (listener: AuthStoreListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  start(): void {
    if (this.stopObserving) return;

    this.stopObserving = observeAuthUser(this.client, (state) => {
      this.setSnapshot({
        ...state,
        initialized: !state.loading,
        error: null,
      });
    });
  }

  stop(): void {
    this.stopObserving?.();
    this.stopObserving = null;
  }

  async signIn(): Promise<void> {
    this.setSnapshot({ ...this.snapshot, loading: true, error: null });
    try {
      await signInWithGoogle(this.client);
    } catch (error) {
      this.setFailure(error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    this.setSnapshot({ ...this.snapshot, loading: true, error: null });
    try {
      await signOut(this.client);
    } catch (error) {
      this.setFailure(error);
      throw error;
    }
  }

  async refresh(): Promise<User> {
    this.setSnapshot({ ...this.snapshot, loading: true, error: null });
    try {
      const user = await refreshSession(this.client);
      this.setSnapshot({
        user,
        loading: false,
        initialized: true,
        error: null,
      });
      return user;
    } catch (error) {
      this.setFailure(error);
      throw error;
    }
  }

  private setFailure(error: unknown): void {
    this.setSnapshot({
      ...this.snapshot,
      loading: false,
      initialized: true,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  private setSnapshot(next: AuthStoreSnapshot): void {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
}
