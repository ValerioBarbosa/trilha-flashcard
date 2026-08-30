import type { SupabaseClient, User } from '@supabase/supabase-js';

export type AuthState = {
  user: User | null;
  loading: boolean;
};

export type AuthUnsubscribe = () => void;

export function observeAuthUser(
  client: SupabaseClient,
  callback: (state: AuthState) => void,
): AuthUnsubscribe {
  callback({ user: null, loading: true });

  let active = true;
  let lastUserId: string | null | undefined = undefined;

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    const userId = user?.id ?? null;

    if (userId === lastUserId) return;
    lastUserId = userId;

    queueMicrotask(() => {
      if (!active) return;
      callback({ user, loading: false });
    });
  });

  return () => {
    active = false;
    data.subscription.unsubscribe();
  };
}

export async function signInWithGoogle(client: SupabaseClient): Promise<void> {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });

  if (error) throw error;
}

export async function signOut(client: SupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function refreshSession(client: SupabaseClient): Promise<User> {
  const { data, error } = await client.auth.refreshSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error('unauthenticated');
  return data.session.user;
}
