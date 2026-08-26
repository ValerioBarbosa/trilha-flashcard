import { describe, expect, it } from "vitest";
import DataModel from "../data-model.js";

describe("identidade permanente dos cartões", () => {
  it("gera o mesmo id ao migrar o mesmo cartão legado", () => {
    const first = [{ id: "constitucional", cards: [{ front: "O que é a Constituição?", back: "Lei fundamental." }] }];
    const second = structuredClone(first);

    DataModel.ensureDeckCardIds(first);
    DataModel.ensureDeckCardIds(second);

    expect(first[0].cards[0].id).toMatch(/^card-/);
    expect(second[0].cards[0].id).toBe(first[0].cards[0].id);
  });

  it("mantém o id legado quando a ordem do baralho muda", () => {
    const original = [{ id: "constitucional", cards: [
      { front: "Pergunta A", back: "Resposta A" },
      { front: "Pergunta B", back: "Resposta B" },
    ] }];
    const reordered = [{ id: "constitucional", cards: [
      { front: "Pergunta B", back: "Resposta B" },
      { front: "Pergunta A", back: "Resposta A" },
    ] }];

    DataModel.ensureDeckCardIds(original);
    DataModel.ensureDeckCardIds(reordered);

    expect(reordered[0].cards[1].id).toBe(original[0].cards[0].id);
    expect(reordered[0].cards[0].id).toBe(original[0].cards[1].id);
  });

  it("preserva ids existentes e resolve duplicidade sem perder cartões", () => {
    const decks = [{ id: "administrativo", cards: [
      { id: "card-permanente", front: "A", back: "1" },
      { id: "card-permanente", front: "B", back: "2" },
    ] }];

    DataModel.ensureDeckCardIds(decks);

    expect(decks[0].cards[0].id).toBe("card-permanente");
    expect(decks[0].cards[1].id).not.toBe("card-permanente");
  });

  it("migra avaliações e a sessão ativa da antiga chave baseada na pergunta", () => {
    const decks = [{ id: "portugues", cards: [{ front: "O que é crase?", back: "Fusão de vogais." }] }];
    const { keyMap } = DataModel.ensureDeckCardIds(decks);
    const oldKey = "portugues::O que é crase?";
    const newKey = DataModel.ratingKey("portugues", decks[0].cards[0]);
    const state = {
      ratings: { [oldKey]: { correct: 2 } },
      activeSession: { currentKey: oldKey, queueKeys: [oldKey], wrongKeys: [oldKey] },
    };

    expect(DataModel.migrateStudyState(state, keyMap)).toBe(true);
    expect(state.ratings[newKey]).toEqual({ correct: 2 });
    expect(state.ratings[oldKey]).toBeUndefined();
    expect(state.activeSession).toEqual({ currentKey: newKey, queueKeys: [newKey], wrongKeys: [newKey] });
  });
});

describe("metadados do perfil de concurso", () => {
  it("normaliza concurso, cargo, banca e ano do edital", () => {
    const profile = DataModel.sanitizeProfile({
      id: "sefaz-rs",
      name: " SEFAZ-RS ",
      role: " Auditor Fiscal ",
      board: " Cebraspe ",
      editalYear: " 2026 ",
    });

    expect(profile).toMatchObject({
      id: "sefaz-rs",
      name: "SEFAZ-RS",
      role: "Auditor Fiscal",
      board: "Cebraspe",
      editalYear: "2026",
    });
    expect(DataModel.profileSummary(profile)).toBe("Auditor Fiscal · Cebraspe · 2026");
  });
});
