import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthStore } from '../src/features/auth/auth-store';

function makeClient() {
  let authCallback: ((event: string, session: { user: User } | null) => void) | undefined;
  const unsubscribe = vi.fn();
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const refreshSession = vi.fn().mockResolvedValue({
    data: { session: { user: { id: 'refreshed-user' } as User } },
    error: null,
  });

  const client = {
    auth: {
      onAuthStateChange(callback: typeof authCallback) {
        authCallback = callback;
        return { data: { subscription: { unsubscribe } } };
      },
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut,
      refreshSession,
    },
  } as unknown as SupabaseClient;

  return {
    client,
    emit(user: User | null) {
      authCallback?.('AUTH_EVENT', user ? { user } : null);
    },
    unsubscribe,
    signOut,
    refreshSession,
  };
}

describe('AuthStore', () => {
  it('mantém uma única assinatura e publica mudanças de autenticação', async () => {
    const fixture = makeClient();
    const store = new AuthStore(fixture.client);
    const snapshots = [] as ReturnType<typeof store.getSnapshot>[];
    const unlisten = store.subscribe((snapshot) => snapshots.push(snapshot));

    store.start();
    store.start();
    fixture.emit({ id: 'user-42' } as User);
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(store.getSnapshot().user?.id).toBe('user-42');
    expect(store.getSnapshot().initialized).toBe(true);
    expect(snapshots.at(-1)?.loading).toBe(false);

    unlisten();
    store.stop();
    expect(fixture.unsubscribe).toHaveBeenCalledOnce();
  });

  it('atualiza o estado com o usuário renovado', async () => {
    const fixture = makeClient();
    const store = new AuthStore(fixture.client);

    const user = await store.refresh();

    expect(user.id).toBe('refreshed-user');
    expect(store.getSnapshot()).toMatchObject({
      loading: false,
      initialized: true,
      error: null,
    });
  });

  it('registra erro sem esconder a falha do chamador', async () => {
    const fixture = makeClient();
    fixture.signOut.mockResolvedValueOnce({ error: new Error('signout-failed') });
    const store = new AuthStore(fixture.client);

    await expect(store.signOut()).rejects.toThrow('signout-failed');
    expect(store.getSnapshot()).toMatchObject({
      loading: false,
      initialized: true,
      error: 'signout-failed',
    });
  });
});
