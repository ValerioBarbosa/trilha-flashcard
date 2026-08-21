import { describe, expect, it } from "vitest";
import CardStorage from "../card-storage.js";

function createFakeStorage({ failAtWrite = Infinity } = {}) {
  const values = new Map();
  let writes = 0;
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem(key, value) {
      writes += 1;
      if (writes === failAtWrite) throw new Error("QuotaExceededError");
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key),
    values,
  };
}

describe("persistência dos baralhos", () => {
  it("salva somente o baralho nativo alterado e confirma a leitura", () => {
    const storage = createFakeStorage();
    const api = CardStorage.createDeckStorage(storage);
    const deck = { id: "direito-constitucional", custom: false, cards: [{ front: "P", back: "R" }] };

    api.persistDecks(new Set([deck]), [deck]);

    expect(api.loadBuiltinOverride(deck.id)).toEqual(deck.cards);
    expect(storage.values.has(CardStorage.LEGACY_BUILTIN_OVERRIDES_KEY)).toBe(false);
  });

  it("continua lendo dados gravados pelo formato antigo", () => {
    const storage = createFakeStorage();
    storage.setItem(CardStorage.LEGACY_BUILTIN_OVERRIDES_KEY, JSON.stringify({ antigo: [{ front: "P", back: "R" }] }));
    const api = CardStorage.createDeckStorage(storage);

    expect(api.loadBuiltinOverride("antigo")).toEqual([{ front: "P", back: "R" }]);
  });

  it("desfaz uma gravação parcial quando o navegador rejeita o armazenamento", () => {
    const storage = createFakeStorage({ failAtWrite: 2 });
    const api = CardStorage.createDeckStorage(storage);
    const first = { id: "primeiro", custom: false, cards: [{ front: "1", back: "A" }] };
    const second = { id: "segundo", custom: false, cards: [{ front: "2", back: "B" }] };

    expect(() => api.persistDecks(new Set([first, second]), [first, second])).toThrow("QuotaExceededError");
    expect(api.loadBuiltinOverride(first.id)).toBeNull();
    expect(api.loadBuiltinOverride(second.id)).toBeNull();
  });
});
