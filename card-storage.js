(function exposeCardStorage(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CardStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCardStorageApi() {
  const CUSTOM_DECKS_KEY = "trilha-flashcard-custom-decks";
  const LEGACY_BUILTIN_OVERRIDES_KEY = "trilha-flashcard-builtin-overrides";
  const BUILTIN_DECK_KEY_PREFIX = "trilha-flashcard-deck:";
  const DEFAULT_PROFILE_ID = "trt4";

  function profileStorageScope(profileId) {
    return {
      exactKeys: [
        `${CUSTOM_DECKS_KEY}::${profileId}`,
        `trilha-flashcard-state::${profileId}`,
        `trilha-flashcard-trash::${profileId}`,
      ],
      prefixes: [`${BUILTIN_DECK_KEY_PREFIX}${profileId}::`],
    };
  }

  function parseJson(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function createDeckStorage(storage, profileId = DEFAULT_PROFILE_ID) {
    const isDefaultProfile = !profileId || profileId === DEFAULT_PROFILE_ID;
    const customDecksKey = isDefaultProfile ? CUSTOM_DECKS_KEY : `${CUSTOM_DECKS_KEY}::${profileId}`;
    const builtinKeyPrefix = isDefaultProfile ? BUILTIN_DECK_KEY_PREFIX : `${BUILTIN_DECK_KEY_PREFIX}${profileId}::`;

    function loadCustomDecks() {
      const value = parseJson(storage.getItem(customDecksKey), []);
      return Array.isArray(value) ? value : [];
    }

    function loadBuiltinOverride(deckId) {
      const current = parseJson(storage.getItem(`${builtinKeyPrefix}${deckId}`), null);
      if (Array.isArray(current)) return current;
      if (!isDefaultProfile) return null;

      const legacy = parseJson(storage.getItem(LEGACY_BUILTIN_OVERRIDES_KEY), {});
      return Array.isArray(legacy?.[deckId]) ? legacy[deckId] : null;
    }

    function buildEntry(deck, allDecks) {
      return deck.custom
        ? {
            key: customDecksKey,
            value: JSON.stringify(allDecks.filter((item) => item.custom)),
          }
        : {
            key: `${builtinKeyPrefix}${deck.id}`,
            value: JSON.stringify(deck.cards),
          };
    }

    function writeVerified(key, value) {
      storage.setItem(key, value);
      if (storage.getItem(key) !== value) throw new Error("storage-verification-failed");
    }

    function persistDecks(changedDecks, allDecks) {
      const entries = new Map();
      changedDecks.forEach((deck) => {
        const entry = buildEntry(deck, allDecks);
        entries.set(entry.key, entry.value);
      });
      const previous = new Map([...entries.keys()].map((key) => [key, storage.getItem(key)]));

      try {
        entries.forEach((value, key) => writeVerified(key, value));
      } catch (error) {
        previous.forEach((value, key) => {
          try {
            if (value === null) storage.removeItem(key);
            else storage.setItem(key, value);
          } catch {
            // Mantém o erro original de persistência.
          }
        });
        throw error;
      }
      return entries;
    }

    return { loadCustomDecks, loadBuiltinOverride, persistDecks };
  }

  return { createDeckStorage, profileStorageScope, CUSTOM_DECKS_KEY, LEGACY_BUILTIN_OVERRIDES_KEY, BUILTIN_DECK_KEY_PREFIX, DEFAULT_PROFILE_ID };
});
