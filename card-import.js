(function exposeCardImport(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CardImport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCardImport() {
  const FIELD_ALIASES = {
    id: ["id", "cardId", "cartaoId", "cartãoId"],
    front: ["front", "pergunta", "question", "frente", "enunciado"],
    back: ["back", "resposta", "answer", "verso", "gabarito"],
    discipline: ["disciplineId", "disciplinaId", "discipline", "disciplina", "deckId", "baralho"],
    topic: ["topic", "assunto"],
    subtopic: ["subtopic", "subassunto"],
    legalBasis: ["legalBasis", "fundamentoLegal", "fundamento_legal", "baseLegal", "base_legal"],
    type: ["type", "tipo"],
    priority: ["priority", "prioridade"],
    difficulty: ["difficulty", "dificuldade"],
    tag: ["tag", "etiqueta"],
    example: ["example", "exemplo", "observacao", "observação"],
    complement: ["complement", "complemento"],
    pitfall: ["pitfall", "pegadinha"],
    mnemonic: ["mnemonic", "mnemonico", "mnemônico", "macete"],
  };

  function firstString(source, aliases) {
    for (const alias of aliases) {
      if (typeof source?.[alias] === "string" && source[alias].trim()) return source[alias].trim();
    }
    return "";
  }

  function normalizeImportedCards(rawCards) {
    if (!Array.isArray(rawCards)) return [];

    return rawCards.flatMap((rawCard) => {
      if (!rawCard || typeof rawCard !== "object") return [];
      const card = {};
      Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
        const value = firstString(rawCard, aliases);
        if (value) card[field] = value;
      });
      return card.front && card.back ? [card] : [];
    });
  }

  function canonicalLabel(label) {
    return label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/^\d+[.)]?\s*/, "")
      .trim()
      .toLowerCase();
  }

  const PDF_LABELS = new Map([
    ["pergunta", "front"], ["questao", "front"], ["frente", "front"], ["enunciado", "front"], ["q", "front"],
    ["resposta", "back"], ["gabarito", "back"], ["verso", "back"], ["a", "back"],
    ["disciplina", "discipline"], ["baralho", "discipline"],
    ["assunto", "topic"], ["topico", "topic"],
    ["subassunto", "subtopic"],
    ["fundamento legal", "legalBasis"], ["base legal", "legalBasis"],
    ["tipo", "type"], ["tipo do cartao", "type"],
    ["prioridade", "priority"], ["dificuldade", "difficulty"],
    ["tag", "tag"], ["etiqueta", "tag"],
    ["exemplo", "example"], ["observacao", "example"],
    ["complemento", "complement"], ["pegadinha", "pitfall"],
    ["mnemonico", "mnemonic"], ["macete", "mnemonic"],
  ]);

  function parseLabeledPdfCards(text) {
    const cards = [];
    const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    let current = {};
    let pending = {};
    let activeField = "";

    const finish = () => {
      if (current.front?.trim() && current.back?.trim()) {
        cards.push({ ...pending, ...current, front: current.front.trim(), back: current.back.trim(), tag: current.tag || pending.tag || "PDF" });
        current = {};
        activeField = "";
      }
    };

    lines.forEach((line) => {
      const match = line.match(/^(.{1,50}?)\s*[:\-–—]\s*(.*)$/);
      const field = match ? PDF_LABELS.get(canonicalLabel(match[1])) : null;
      if (field) {
        const value = match[2].trim();
        if (field === "front") {
          finish();
          current = { ...pending, front: value };
          pending = {};
        } else if (field === "discipline" && current.front && current.back) {
          finish();
          pending[field] = value;
        } else if (!current.front) {
          pending[field] = value;
        } else {
          current[field] = value;
        }
        activeField = field;
      } else if (activeField) {
        const target = current.front ? current : pending;
        target[activeField] = `${target[activeField] || ""}\n${line}`.trim();
      }
    });
    finish();
    return cards;
  }

  function parsePdfPageFallback(text, pageNumber) {
    const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
    if (blocks.length >= 2) {
      return { front: blocks[0], back: blocks.slice(1).join("\n\n"), tag: "PDF", complement: `Importado da página ${pageNumber}.` };
    }
    const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    if (lines.length >= 2) {
      return { front: lines[0], back: lines.slice(1).join("\n"), tag: "PDF", complement: `Importado da página ${pageNumber}.` };
    }
    return null;
  }

  return { normalizeImportedCards, parseLabeledPdfCards, parsePdfPageFallback };
});
