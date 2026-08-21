import { describe, expect, it } from "vitest";
import CardImport from "../card-import.js";

const { normalizeImportedCards, parseLabeledPdfCards } = CardImport;

describe("importação de cartões", () => {
  it("aceita campos em português e preserva a classificação", () => {
    expect(normalizeImportedCards([{
      pergunta: "Qual é a competência?",
      resposta: "A prevista no art. 114 da CF.",
      disciplina: "Direito Processual do Trabalho",
      assunto: "Organização e competência da Justiça do Trabalho",
      subassunto: "Competência material",
      fundamentoLegal: "CF, art. 114",
      tipo: "Lei seca",
      prioridade: "A",
      dificuldade: "Médio",
    }])).toEqual([{
      front: "Qual é a competência?",
      back: "A prevista no art. 114 da CF.",
      discipline: "Direito Processual do Trabalho",
      topic: "Organização e competência da Justiça do Trabalho",
      subtopic: "Competência material",
      legalBasis: "CF, art. 114",
      type: "Lei seca",
      priority: "A",
      difficulty: "Médio",
    }]);
  });

  it("extrai pergunta, resposta e classificação de PDF rotulado", () => {
    const cards = parseLabeledPdfCards(`
      Disciplina: Direito Processual do Trabalho
      Assunto: Organização e competência da Justiça do Trabalho
      Fundamento legal: CF, art. 114
      Pergunta: Qual é a competência material da Justiça do Trabalho?
      Resposta: Processar e julgar ações oriundas da relação de trabalho.
      Pegadinha: Relação de trabalho é mais ampla que relação de emprego.
    `);
    expect(cards).toEqual([expect.objectContaining({
      discipline: "Direito Processual do Trabalho",
      topic: "Organização e competência da Justiça do Trabalho",
      legalBasis: "CF, art. 114",
      front: "Qual é a competência material da Justiça do Trabalho?",
      back: "Processar e julgar ações oriundas da relação de trabalho.",
      pitfall: "Relação de trabalho é mais ampla que relação de emprego.",
    })]);
  });

  it("descarta entradas sem pergunta ou resposta", () => {
    expect(normalizeImportedCards([{ pergunta: "Sem resposta" }, null, {}])).toEqual([]);
  });
});
