(function exposeDataModel(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DataModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDataModelApi() {
  function hashString(value) {
    let hash = 2166136261;
    const input = String(value || "");
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function createId(prefix = "id") {
    const random = globalThis.crypto?.randomUUID?.()
      || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    return `${prefix}-${random}`;
  }

  function isValidId(value) {
    return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{5,127}$/.test(value);
  }

  function legacyCardId(deckId, card) {
    return `card-${hashString(`${deckId}|${card?.front || ""}|${card?.back || ""}`)}`;
  }

  function ensureCardId(card, deckId, index = 0, usedIds = new Set()) {
    if (!card || typeof card !== "object") return "";
    let id = isValidId(card.id) && !usedIds.has(card.id)
      ? card.id
      : legacyCardId(deckId, card);
    let suffix = 2;
    const baseId = id;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    card.id = id;
    usedIds.add(id);
    return id;
  }

  function ratingKey(deckId, card) {
    return `${deckId}::${card?.id || card?.front || ""}`;
  }

  function legacyRatingKey(deckId, card) {
    return `${deckId}::${card?.front || ""}`;
  }

  function ensureDeckCardIds(decks) {
    const usedIds = new Set();
    const keyMap = {};
    const changedDecks = new Set();
    (decks || []).forEach((deck) => {
      (deck.cards || []).forEach((card, index) => {
        const previousId = card?.id;
        const oldKey = legacyRatingKey(deck.id, card);
        ensureCardId(card, deck.id, index, usedIds);
        const newKey = ratingKey(deck.id, card);
        if (oldKey !== newKey) keyMap[oldKey] = newKey;
        if (previousId !== card.id) changedDecks.add(deck);
      });
    });
    return { changedDecks, keyMap };
  }

  function remapKey(key, keyMap) {
    return typeof key === "string" ? keyMap[key] || key : key;
  }

  function migrateStudyState(savedState, keyMap) {
    if (!savedState || typeof savedState !== "object") return false;
    let changed = false;
    if (savedState.ratings && typeof savedState.ratings === "object" && !Array.isArray(savedState.ratings)) {
      Object.entries(keyMap).forEach(([oldKey, newKey]) => {
        if (!savedState.ratings[oldKey]) return;
        if (!savedState.ratings[newKey]) savedState.ratings[newKey] = savedState.ratings[oldKey];
        delete savedState.ratings[oldKey];
        changed = true;
      });
    }
    const session = savedState.activeSession;
    if (session && typeof session === "object") {
      ["queueKeys", "wrongKeys"].forEach((field) => {
        if (!Array.isArray(session[field])) return;
        const next = session[field].map((key) => remapKey(key, keyMap));
        if (next.some((key, index) => key !== session[field][index])) changed = true;
        session[field] = next;
      });
      const nextCurrent = remapKey(session.currentKey, keyMap);
      if (nextCurrent !== session.currentKey) changed = true;
      session.currentKey = nextCurrent;
    }
    return changed;
  }

  function sanitizeProfile(profile) {
    if (!profile || typeof profile.id !== "string" || typeof profile.name !== "string") return null;
    return {
      id: profile.id,
      name: profile.name.trim(),
      builtin: Boolean(profile.builtin),
      role: typeof profile.role === "string" ? profile.role.trim() : "",
      board: typeof profile.board === "string" ? profile.board.trim() : "",
      editalYear: typeof profile.editalYear === "string" ? profile.editalYear.trim() : "",
    };
  }

  function profileSummary(profile) {
    return [profile?.role, profile?.board, profile?.editalYear].filter(Boolean).join(" · ");
  }

  return {
    createId,
    ensureCardId,
    ensureDeckCardIds,
    hashString,
    isValidId,
    legacyRatingKey,
    migrateStudyState,
    profileSummary,
    ratingKey,
    sanitizeProfile,
  };
});
