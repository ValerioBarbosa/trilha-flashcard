import { describe, expect, it } from "vitest";
import deckModule from "../decks.js";

const { trt4Decks } = deckModule;

describe("edital TRT-4 AJAJ versão 3", () => {
  it("identifica a versão atual e a situação oficial de 2026", () => {
    const overview = trt4Decks.find((deck) => deck.id === "trt4-overview");

    expect(overview.title).toContain("Edital V3");
    expect(overview.sourceNote).toContain("29/08/2026");
    expect(overview.topics).toContain("Situação oficial do concurso em 2026");
  });

  it("substitui o protocolo de redação pelo Estudo de Caso sem trocar o id legado", () => {
    const caseStudy = trt4Decks.find((deck) => deck.id === "fcc-writing");

    expect(caseStudy.title).toBe("Estudo de Caso Jurídico · AJAJ");
    expect(caseStudy.topics).toContain("Aplicação da norma aos fatos");
  });

  it("mantém todos os baralhos do edital verticalizado sem nenhum cartão", () => {
    expect(trt4Decks.every((deck) => Array.isArray(deck.cards) && deck.cards.length === 0)).toBe(true);
  });
});
