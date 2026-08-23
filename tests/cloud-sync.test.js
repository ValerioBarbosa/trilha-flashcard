import { describe, expect, it } from "vitest";
import CloudSync from "../cloud-sync.js";

const { applySnapshot, createFirebaseAdapter, createSnapshot, hasStudyData, isSyncableKey, reconciliationAction, snapshotFingerprint } = CloudSync;

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    dump() { return Object.fromEntries(data); },
  };
}

describe("cloud sync", () => {
  it("usa popup no login Google para funcionar em hosts externos ao Firebase", () => {
    const adapterSource = createFirebaseAdapter.toString();
    expect(adapterSource).toContain("signInWithPopup");
    expect(adapterSource).not.toContain("signInWithRedirect");
  });

  it("exporta apenas dados de estudo e exclui preferências locais", () => {
    const storage = memoryStorage({
      "trilha-flashcard-state": "{\"ratings\":{}}",
      "trilha-flashcard-theme": "dark",
      "outro-app": "segredo",
    });
    expect(createSnapshot(storage)).toEqual({
      version: 1,
      entries: { "trilha-flashcard-state": "{\"ratings\":{}}" },
    });
  });

  it("restaura somente chaves permitidas", () => {
    const storage = memoryStorage({ "trilha-flashcard-deck:obsoleto": "[]" });
    applySnapshot(storage, { version: 1, entries: {
      "trilha-flashcard-state": "ok",
      "trilha-flashcard-theme": "dark",
      "outro-app": "não",
    } });
    expect(storage.dump()).toEqual({ "trilha-flashcard-state": "ok" });
  });

  it("reenvia alteração durável que ficou pendente ao fechar o app", () => {
    const local = { version: 1, entries: { "trilha-flashcard-state": "novo" } };
    const remote = { updatedAtISO: "base", snapshot: { version: 1, entries: { "trilha-flashcard-state": "antigo" } } };
    expect(reconciliationAction({
      local,
      remote,
      uid: "user-1",
      meta: { uid: "user-1", remoteUpdatedAtISO: "base", dirty: true },
    })).toBe("upload");
  });

  it("detecta alteração local mesmo se o marcador dirty for perdido", () => {
    const local = { version: 1, entries: { "trilha-flashcard-state": "novo" } };
    expect(reconciliationAction({
      local,
      remote: { updatedAtISO: "base", snapshot: local },
      uid: "user-1",
      meta: { uid: "user-1", remoteUpdatedAtISO: "base", dirty: false, syncedFingerprint: snapshotFingerprint({ version: 1, entries: {} }) },
    })).toBe("upload");
  });

  it("abre conflito quando a nuvem mudou em outro dispositivo", () => {
    const local = { version: 1, entries: { "trilha-flashcard-state": "local" } };
    expect(reconciliationAction({
      local,
      remote: { updatedAtISO: "remoto-2", snapshot: local },
      uid: "user-1",
      meta: { uid: "user-1", remoteUpdatedAtISO: "remoto-1", dirty: true },
    })).toBe("conflict");
  });

  it("detecta dados que precisam ser migrados", () => {
    expect(hasStudyData({ version: 1, entries: { "trilha-flashcard-deck:direito": "[]" } })).toBe(true);
    expect(isSyncableKey("trilha-flashcard-cloud-meta")).toBe(false);
  });
});
