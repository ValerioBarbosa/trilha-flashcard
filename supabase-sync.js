(function exposeSupabaseSync(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SupabaseSync = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSupabaseSyncApi() {
  const TABLE = "flashcard_sync_entries";

  function contentHash(value) {
    const input = String(value ?? "");
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function rowsToRemote(rows) {
    const activeRows = (rows || []).filter((row) => !row.deleted && typeof row.storage_value === "string");
    const entries = Object.fromEntries(activeRows.map((row) => [row.storage_key, row.storage_value]));
    const updatedAtISO = (rows || []).reduce((latest, row) => (
      String(row.updated_at || "") > latest ? String(row.updated_at) : latest
    ), "");
    return rows?.length ? { updatedAtISO, snapshot: { version: 1, entries } } : null;
  }

  function buildChangedRows(uid, snapshot, remoteRows, updatedAtISO = new Date().toISOString()) {
    const localEntries = snapshot?.entries || {};
    const remoteByKey = new Map((remoteRows || []).map((row) => [row.storage_key, row]));
    const rows = [];

    Object.entries(localEntries).forEach(([storageKey, storageValue]) => {
      const nextHash = contentHash(storageValue);
      const previous = remoteByKey.get(storageKey);
      if (!previous || previous.deleted || previous.content_hash !== nextHash) {
        rows.push({
          user_id: uid,
          storage_key: storageKey,
          storage_value: storageValue,
          content_hash: nextHash,
          deleted: false,
          updated_at: updatedAtISO,
        });
      }
      remoteByKey.delete(storageKey);
    });

    remoteByKey.forEach((previous, storageKey) => {
      if (!previous.deleted) {
        rows.push({
          user_id: uid,
          storage_key: storageKey,
          storage_value: null,
          content_hash: contentHash(""),
          deleted: true,
          updated_at: updatedAtISO,
        });
      }
    });
    return rows;
  }

  function observeAuthUser(auth, callback) {
    let active = true;
    let lastUserKey = Symbol("initial-auth-state");
    const { data } = auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      const userKey = user?.id || null;
      if (userKey === lastUserKey) return;
      lastUserKey = userKey;
      queueMicrotask(() => {
        if (!active) return;
        Promise.resolve(callback(user)).catch((error) => {
          console.error("Falha ao processar mudança de autenticação Supabase", error);
        });
      });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }

  async function createSupabaseAdapter(config) {
    if (!config?.url || !config?.publishableKey) throw new Error("supabase-not-configured");
    const { createClient } = await import("./vendor/supabase-js.mjs");
    const client = createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    let lastRows = [];

    async function fetchRows(uid) {
      const { data, error } = await client
        .from(TABLE)
        .select("storage_key,storage_value,content_hash,deleted,updated_at")
        .eq("user_id", uid);
      if (error) throw error;
      lastRows = data || [];
      return lastRows;
    }

    return {
      provider: "supabase",
      observeUser(callback) {
        return observeAuthUser(client.auth, callback);
      },
      async signIn() {
        const { data, error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${location.origin}${location.pathname}` },
        });
        if (error) throw error;
        return data;
      },
      async signOut() {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      },
      async refreshAuth() {
        const { data, error } = await client.auth.refreshSession();
        if (error) throw error;
        if (!data.session) throw new Error("unauthenticated");
      },
      async read(uid) {
        return rowsToRemote(await fetchRows(uid));
      },
      async write(uid, snapshot, { expectedUpdatedAtISO = null, force = false } = {}) {
        const remoteRows = await fetchRows(uid);
        const remote = rowsToRemote(remoteRows);
        const remoteToken = remote?.updatedAtISO || null;
        if (!force && remoteToken !== (expectedUpdatedAtISO || null)) throw new Error("cloud-conflict");

        const updatedAtISO = new Date().toISOString();
        const rows = buildChangedRows(uid, snapshot, remoteRows, updatedAtISO);
        if (rows.length) {
          const { data, error } = await client
            .from(TABLE)
            .upsert(rows, { onConflict: "user_id,storage_key" })
            .select("updated_at");
          if (error) throw error;
          const serverToken = (data || []).reduce((latest, row) => (
            String(row.updated_at || "") > latest ? String(row.updated_at) : latest
          ), "");
          if (serverToken) return serverToken;
        }
        lastRows = remoteRows;
        return remoteToken || updatedAtISO;
      },
    };
  }

  return { buildChangedRows, contentHash, createSupabaseAdapter, observeAuthUser, rowsToRemote };
});
