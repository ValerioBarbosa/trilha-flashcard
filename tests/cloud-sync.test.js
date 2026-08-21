const { describe, expect, it } = require("vitest");
const { applySnapshot, createSnapshot, hasStudyData, isSyncableKey } = require("../cloud-sync.js");

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    dump() { return Object.fromEntries(data); },
  };
}

describe("cloud sync", () => {
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
    const storage = memoryStorage();
    applySnapshot(storage, { version: 1, entries: {
      "trilha-flashcard-state": "ok",
      "trilha-flashcard-theme": "dark",
      "outro-app": "não",
    } });
    expect(storage.dump()).toEqual({ "trilha-flashcard-state": "ok" });
  });

  it("detecta dados que precisam ser migrados", () => {
    expect(hasStudyData({ version: 1, entries: { "trilha-flashcard-deck:direito": "[]" } })).toBe(true);
    expect(isSyncableKey("trilha-flashcard-cloud-meta")).toBe(false);
  });
});
