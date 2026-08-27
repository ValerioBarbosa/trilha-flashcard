import { describe, expect, it } from "vitest";
import SupabaseSync from "../supabase-sync.js";

const { buildChangedRows, contentHash, observeAuthUser, rowsToRemote } = SupabaseSync;

describe("sincronização incremental Supabase", () => {
  it("converte somente registros ativos em snapshot local", () => {
    const remote = rowsToRemote([
      { storage_key: "trilha-flashcard-state", storage_value: "novo", content_hash: contentHash("novo"), deleted: false, updated_at: "2026-08-27T10:00:00.000Z" },
      { storage_key: "trilha-flashcard-trash", storage_value: null, content_hash: contentHash(""), deleted: true, updated_at: "2026-08-27T11:00:00.000Z" },
    ]);
    expect(remote.snapshot.entries).toEqual({ "trilha-flashcard-state": "novo" });
    expect(remote.updatedAtISO).toBe("2026-08-27T11:00:00.000Z");
  });

  it("envia somente chaves alteradas", () => {
    const remote = [
      { storage_key: "trilha-flashcard-state", storage_value: "antigo", content_hash: contentHash("antigo"), deleted: false },
      { storage_key: "trilha-flashcard-deck:direito", storage_value: "[]", content_hash: contentHash("[]"), deleted: false },
    ];
    const rows = buildChangedRows("00000000-0000-0000-0000-000000000001", {
      version: 1,
      entries: { "trilha-flashcard-state": "novo", "trilha-flashcard-deck:direito": "[]" },
    }, remote, "2026-08-27T12:00:00.000Z");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ storage_key: "trilha-flashcard-state", storage_value: "novo", deleted: false });
  });

  it("usa tombstone para exclusões e evita ressuscitar dados antigos", () => {
    const rows = buildChangedRows("00000000-0000-0000-0000-000000000001", { version: 1, entries: {} }, [
      { storage_key: "trilha-flashcard-deck:removido", storage_value: "[]", content_hash: contentHash("[]"), deleted: false },
    ], "2026-08-27T12:00:00.000Z");
    expect(rows).toEqual([expect.objectContaining({
      storage_key: "trilha-flashcard-deck:removido",
      storage_value: null,
      deleted: true,
    })]);
  });

  it("reconcilia uma única vez quando a sessão inicial se repete", async () => {
    let authCallback;
    let unsubscribed = false;
    const auth = {
      onAuthStateChange(callback) {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
      },
    };
    const users = [];
    const stop = observeAuthUser(auth, async (user) => users.push(user?.id || null));

    authCallback("INITIAL_SESSION", { user: { id: "user-1" } });
    authCallback("SIGNED_IN", { user: { id: "user-1" } });
    authCallback("TOKEN_REFRESHED", { user: { id: "user-1" } });
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(users).toEqual(["user-1"]);
    stop();
    expect(unsubscribed).toBe(true);
  });
});
