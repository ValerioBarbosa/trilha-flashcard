import { describe, expect, it } from "vitest";
import CardManager from "../card-manager.js";

const cards = [
  { front: "Prazo prescricional", back: "Cinco anos", topic: "Prescrição", priority: "A", difficulty: "Difícil", tag: "trt4" },
  { front: "Jus postulandi", back: "Regra geral", topic: "Partes", priority: "B", difficulty: "Médio" },
  { front: "Prescrição intercorrente", back: "Dois anos", topic: "Prescrição", priority: "A", difficulty: "Médio", legalBasis: "CLT, art. 11-A" },
];

describe("organização do gerenciador de cartões", () => {
  it("agrupa por assunto mantendo o índice original para edição", () => {
    const result = CardManager.organizeCards(cards, { sort: "topic" });
    expect(result.groups.map((group) => [group.name, group.entries.length])).toEqual([
      ["Partes", 1],
      ["Prescrição", 2],
    ]);
    expect(result.groups[0].entries[0].index).toBe(1);
  });

  it("filtra por busca, prioridade e dificuldade", () => {
    expect(CardManager.organizeCards(cards, { query: "11-a" }).filtered).toBe(1);
    expect(CardManager.organizeCards(cards, { priority: "A" }).filtered).toBe(2);
    expect(CardManager.organizeCards(cards, { difficulty: "Difícil" }).filtered).toBe(1);
  });

  it("faz busca sem depender de acentos", () => {
    expect(CardManager.organizeCards(cards, { query: "prescricao" }).filtered).toBe(2);
  });

  it("detecta enunciados duplicados ignorando acentos, espaços e caixa", () => {
    const repeated = [...cards, { front: "  PRAZO   PRESCRICIONAL ", back: "Outro", topic: "Prescrição" }];
    expect([...CardManager.findDuplicateIndices(repeated)]).toEqual([0, 3]);
    expect(CardManager.organizeCards(repeated, { duplicatesOnly: true }).filtered).toBe(2);
  });

  it("bloqueia na importação cartões já incluídos e repetições do mesmo arquivo", () => {
    const deck = { id: "trabalho", cards: [{ front: "Prazo prescricional", back: "Cinco anos" }] };
    const candidates = CardManager.classifyImportCards([
      { front: " PRAZO   PRESCRICIONAL ", back: "Outra resposta" },
      { front: "Jus postulandi", back: "Regra geral" },
      { front: "jus  postulandi", back: "Resposta repetida" },
      { front: "Competência territorial", back: "CLT" },
    ], () => deck);

    expect(candidates.map(({ duplicate, reason }) => [duplicate, reason])).toEqual([
      [true, "included"],
      [false, ""],
      [true, "file"],
      [false, ""],
    ]);
  });

  it("cria subgrupos por subassunto", () => {
    const result = CardManager.organizeCards([
      { front: "A", back: "1", topic: "Judiciário", subtopic: "Justiça do Trabalho" },
      { front: "B", back: "2", topic: "Judiciário", subtopic: "STF" },
      { front: "C", back: "3", topic: "Judiciário" },
    ]);
    expect(result.groups[0].subgroups.map((group) => group.name)).toEqual(["Justiça do Trabalho", "STF", "Geral"]);
  });
});
