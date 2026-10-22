import { describe, expect, it } from "vitest";
import deckModule from "../decks.js";

const { trt4Decks } = deckModule;

describe("edital TRT-4 AJAJ 2026", () => {
  it("identifica a versão atual e a situação oficial de 2026", () => {
    const overview = trt4Decks.find((deck) => deck.id === "trt4-overview");

    expect(overview.title).toContain("Edital nº 1/2026");
    expect(overview.sourceNote).toContain("22/10/2026");
    expect(overview.sourceNote).toContain("30 questões gerais com peso 1");
    expect(overview.sourceNote).toContain("https://www.in.gov.br/web/dou/-/edital-n-1/2026-739927397");
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
