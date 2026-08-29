import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  observeAuthUser,
  refreshSession,
  signInWithGoogle,
  signOut,
} from '../src/services/auth/supabase-auth';

function fakeUser(id = 'user-1'): User {
  return { id } as User;
}

describe('supabase auth service', () => {
  it('observa usuário por user.id e ignora eventos duplicados', async () => {
    let authCallback: ((event: string, session: { user: User } | null) => void) | undefined;
    const unsubscribe = vi.fn();
    const client = {
      auth: {
        onAuthStateChange(callback: typeof authCallback) {
          authCallback = callback;
          return { data: { subscription: { unsubscribe } } };
        },
      },
    } as unknown as SupabaseClient;

    const states: Array<{ id: string | null; loading: boolean }> = [];
    const stop = observeAuthUser(client, (state) => {
      states.push({ id: state.user?.id ?? null, loading: state.loading });
    });

    expect(states).toEqual([{ id: null, loading: true }]);

    authCallback?.('SIGNED_IN', { user: fakeUser('abc') });
    authCallback?.('TOKEN_REFRESHED', { user: fakeUser('abc') });
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(states).toEqual([
      { id: null, loading: true },
      { id: 'abc', loading: false },
    ]);

    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('usa OAuth Google com redirect para a página atual', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: {}, error: null });
    const client = { auth: { signInWithOAuth } } as unknown as SupabaseClient;

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { origin: 'https://example.test', pathname: '/trilha/' } },
    });

    await signInWithGoogle(client);

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://example.test/trilha/' },
    });
  });

  it('propaga erro de logout', async () => {
    const error = new Error('logout-failed');
    const client = {
      auth: { signOut: vi.fn().mockResolvedValue({ error }) },
    } as unknown as SupabaseClient;

    await expect(signOut(client)).rejects.toThrow('logout-failed');
  });

  it('retorna o usuário ao renovar uma sessão válida', async () => {
    const user = fakeUser('refresh-user');
    const client = {
      auth: {
        refreshSession: vi.fn().mockResolvedValue({
          data: { session: { user } },
          error: null,
        }),
      },
    } as unknown as SupabaseClient;

    await expect(refreshSession(client)).resolves.toBe(user);
  });

  it('rejeita refresh sem usuário autenticado', async () => {
    const client = {
      auth: {
        refreshSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
    } as unknown as SupabaseClient;

    await expect(refreshSession(client)).rejects.toThrow('unauthenticated');
  });
});
