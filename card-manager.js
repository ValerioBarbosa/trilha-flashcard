(function exposeCardManager(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CardManager = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCardManagerApi() {
  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function duplicateKey(card) {
    return normalize(card?.front).replace(/\s+/g, " ").trim();
  }

  function findDuplicateIndices(cards) {
    const groups = new Map();
    cards.forEach((card, index) => {
      const key = duplicateKey(card);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(index);
    });
    return new Set([...groups.values()].filter((indices) => indices.length > 1).flat());
  }

  function classifyImportCards(cards, resolveDeck) {
    const acceptedKeys = new Set();
    return cards.map((card) => {
      const deck = resolveDeck(card);
      const key = duplicateKey(card);
      const scopedKey = `${deck?.id || ""}\u0000${key}`;
      const alreadyIncluded = Boolean(key && deck?.cards?.some((existing) => duplicateKey(existing) === key));
      const repeatedInFile = Boolean(key && !alreadyIncluded && acceptedKeys.has(scopedKey));
      if (key && !alreadyIncluded && !repeatedInFile) acceptedKeys.add(scopedKey);
      return {
        card,
        deck,
        duplicate: alreadyIncluded || repeatedInFile,
        reason: alreadyIncluded ? "included" : repeatedInFile ? "file" : "",
      };
    });
  }

  function organizeCards(cards, filters = {}) {
    const query = normalize(filters.query).trim();
    const topic = filters.topic || "";
    const priority = filters.priority || "";
    const difficulty = filters.difficulty || "";
    const sort = filters.sort || "original";
    const duplicateIndices = findDuplicateIndices(cards);

    const entries = cards.map((card, index) => ({
      card,
      index,
      topic: card.topic || "Sem assunto",
      searchValue: normalize([
        card.front,
        card.back,
        card.topic,
        card.subtopic,
        card.legalBasis,
        card.type,
        card.priority,
        card.difficulty,
        card.tag,
      ].filter(Boolean).join(" ")),
    })).filter((entry) => (
      (!query || entry.searchValue.includes(query))
      && (!topic || entry.topic === topic)
      && (!priority || entry.card.priority === priority)
      && (!difficulty || entry.card.difficulty === difficulty)
      && (!filters.duplicatesOnly || duplicateIndices.has(entry.index))
    ));

    const priorityRank = { A: 0, B: 1, C: 2 };
    entries.sort((left, right) => {
      if (sort === "alphabetical") return left.card.front.localeCompare(right.card.front, "pt-BR");
      if (sort === "priority") {
        const rank = (priorityRank[left.card.priority] ?? 9) - (priorityRank[right.card.priority] ?? 9);
        return rank || left.card.front.localeCompare(right.card.front, "pt-BR");
      }
      if (sort === "topic") {
        return left.topic.localeCompare(right.topic, "pt-BR") || left.card.front.localeCompare(right.card.front, "pt-BR");
      }
      return left.index - right.index;
    });

    const grouped = new Map();
    entries.forEach((entry) => {
      if (!grouped.has(entry.topic)) grouped.set(entry.topic, []);
      grouped.get(entry.topic).push(entry);
    });

    return {
      total: cards.length,
      filtered: entries.length,
      duplicateIndices,
      groups: [...grouped].map(([name, groupEntries]) => {
        const subgroups = new Map();
        groupEntries.forEach((entry) => {
          const subtopic = entry.card.subtopic || "Geral";
          if (!subgroups.has(subtopic)) subgroups.set(subtopic, []);
          subgroups.get(subtopic).push(entry);
        });
        return {
          name,
          entries: groupEntries,
          subgroups: [...subgroups].map(([subtopic, subgroupEntries]) => ({ name: subtopic, entries: subgroupEntries })),
        };
      }),
    };
  }

  return { normalize, organizeCards, duplicateKey, findDuplicateIndices, classifyImportCards };
});
