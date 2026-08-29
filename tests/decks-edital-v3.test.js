import { describe, expect, it } from "vitest";
import deckModule from "../decks.js";

const { trt4Decks } = deckModule;

describe("edital TRT-4 AJAJ versão 3", () => {
  it("identifica a versão atual e a situação oficial de 2026", () => {
    const overview = trt4Decks.find((deck) => deck.id === "trt4-overview");

    expect(overview.title).toContain("Edital V3");
    expect(overview.sourceNote).toContain("29/08/2026");
    expect(overview.topics).toContain("Situação oficial do concurso em 2026");
    expect(overview.cards.some((card) => card.back === "Estudo de Caso Jurídico.")).toBe(true);
  });

  it("substitui o protocolo de redação pelo Estudo de Caso sem trocar o id legado", () => {
    const caseStudy = trt4Decks.find((deck) => deck.id === "fcc-writing");

    expect(caseStudy.title).toBe("Estudo de Caso Jurídico · AJAJ");
    expect(caseStudy.topics).toContain("Aplicação da norma aos fatos");
    expect(caseStudy.cards).toHaveLength(12);
    expect(caseStudy.cards.every((card) => card.priority === "A")).toBe(true);
  });

  it("mantém os percentuais históricos explicitamente separados do novo edital", () => {
    const overview = trt4Decks.find((deck) => deck.id === "trt4-overview");
    const weightsCard = overview.cards.find((card) => card.front.includes("pesos e mínimos"));

    expect(weightsCard.back).toContain("referência histórica");
    expect(weightsCard.complement).toContain("2022");
  });
});
