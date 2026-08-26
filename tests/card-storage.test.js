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

describe("perfis de concurso", () => {
  it("descreve todas as chaves exclusivas que devem ser apagadas com um perfil", () => {
    expect(CardStorage.profileStorageScope("sefaz-rs")).toEqual({
      exactKeys: [
        "trilha-flashcard-custom-decks::sefaz-rs",
        "trilha-flashcard-state::sefaz-rs",
        "trilha-flashcard-trash::sefaz-rs",
      ],
      prefixes: ["trilha-flashcard-deck:sefaz-rs::"],
    });
  });

  it("usa as mesmas chaves de sempre para o perfil padrão", () => {
    const storage = createFakeStorage();
    const api = CardStorage.createDeckStorage(storage, CardStorage.DEFAULT_PROFILE_ID);
    const custom = { id: "meu-baralho", custom: true, cards: [{ front: "P", back: "R" }] };

    api.persistDecks(new Set([custom]), [custom]);

    expect(storage.values.has(CardStorage.CUSTOM_DECKS_KEY)).toBe(true);
  });

  it("isola os baralhos customizados entre perfis diferentes", () => {
    const storage = createFakeStorage();
    const sefaz = CardStorage.createDeckStorage(storage, "sefaz-rs");
    const abin = CardStorage.createDeckStorage(storage, "abin");
    const sefazDeck = { id: "tributario", custom: true, cards: [{ front: "P1", back: "R1" }] };
    const abinDeck = { id: "inteligencia", custom: true, cards: [{ front: "P2", back: "R2" }] };

    sefaz.persistDecks(new Set([sefazDeck]), [sefazDeck]);
    abin.persistDecks(new Set([abinDeck]), [abinDeck]);

    expect(sefaz.loadCustomDecks()).toEqual([sefazDeck]);
    expect(abin.loadCustomDecks()).toEqual([abinDeck]);
  });

  it("isola os overrides de baralho nativo por perfil", () => {
    const storage = createFakeStorage();
    const trt4 = CardStorage.createDeckStorage(storage, CardStorage.DEFAULT_PROFILE_ID);
    const outro = CardStorage.createDeckStorage(storage, "outro-concurso");
    const deck = { id: "direito-constitucional", custom: false, cards: [{ front: "P", back: "R" }] };

    trt4.persistDecks(new Set([deck]), [deck]);

    expect(trt4.loadBuiltinOverride(deck.id)).toEqual(deck.cards);
    expect(outro.loadBuiltinOverride(deck.id)).toBeNull();
  });
});
