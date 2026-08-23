import { describe, expect, it } from "vitest";
import CloudSync from "../cloud-sync.js";

const { flattenLocalState, hydrateDecks, hydrateRatings, mergeState, planRemoteWrites } = CloudSync;

function makeLocalState() {
  return {
    decks: [
      {
        id: "labor-law",
        title: "Direito do Trabalho",
        topics: ["Princípios"],
        cards: [
          { id: "card-1", front: "Pergunta 1", back: "Resposta 1", topic: "Princípios", updatedAt: "2026-01-01T00:00:00.000Z" },
          { id: "card-2", front: "Pergunta 2", back: "Resposta 2", topic: "Princípios", updatedAt: "2026-01-01T00:00:00.000Z" },
        ],
      },
    ],
    ratings: {
      "labor-law::card-1": { attempts: 1, stage: 1, lastResult: "good", lastReviewed: "2026-01-02T00:00:00.000Z" },
    },
    graves: [],
  };
}

describe("flattenLocalState / hydrateDecks / hydrateRatings", () => {
  it("faz o round-trip decks -> registros planos -> decks sem perder cartões", () => {
    const local = makeLocalState();
    const flat = flattenLocalState(local);
    expect(flat.cards).toHaveLength(2);
    expect(flat.cards[0]).toMatchObject({ id: "card-1", deckId: "labor-law", front: "Pergunta 1" });

    const hydrated = hydrateDecks(flat);
    expect(hydrated).toHaveLength(1);
    expect(hydrated[0].cards.map((card) => card.id)).toEqual(["card-1", "card-2"]);
  });

  it("faz o round-trip ratings -> registros planos -> mapa de ratings", () => {
    const local = makeLocalState();
    const flat = flattenLocalState(local);
    expect(flat.ratings).toEqual([
      { id: "card-1", deckId: "labor-law", attempts: 1, stage: 1, lastResult: "good", lastReviewed: "2026-01-02T00:00:00.000Z" },
    ]);
    expect(hydrateRatings(flat)).toEqual(local.ratings);
  });
});

describe("mergeState", () => {
  it("mantém o registro mais recente por id, não o documento inteiro", () => {
    const local = flattenLocalState(makeLocalState());
    const remote = flattenLocalState({
      decks: [{
        id: "labor-law",
        title: "Direito do Trabalho",
        topics: ["Princípios"],
        cards: [
          { id: "card-1", front: "Pergunta 1 (editada em outro aparelho)", back: "Resposta 1", topic: "Princípios", updatedAt: "2026-01-03T00:00:00.000Z" },
        ],
      }],
      ratings: {},
      graves: [],
    });

    const merged = mergeState(local, remote);
    const card1 = merged.cards.find((card) => card.id === "card-1");
    const card2 = merged.cards.find((card) => card.id === "card-2");
    expect(card1.front).toBe("Pergunta 1 (editada em outro aparelho)");
    expect(card2).toBeDefined();
  });

  it("uma exclusão (grave) remove o registro em ambos os lados, mesmo sem o outro lado saber da exclusão", () => {
    const local = flattenLocalState(makeLocalState());
    const remote = flattenLocalState(makeLocalState());
    local.graves.push({ id: "card-2", type: "card", deckId: "labor-law", deletedAt: "2026-01-05T00:00:00.000Z" });

    const merged = mergeState(local, remote);
    expect(merged.cards.map((card) => card.id)).toEqual(["card-1"]);
  });

  it("uma edição depois da exclusão (grave mais antigo) ressuscita o cartão", () => {
    const local = flattenLocalState(makeLocalState());
    const remote = flattenLocalState(makeLocalState());
    local.graves.push({ id: "card-2", type: "card", deckId: "labor-law", deletedAt: "2025-12-01T00:00:00.000Z" });

    const merged = mergeState(local, remote);
    expect(merged.cards.map((card) => card.id)).toContain("card-2");
  });

  it("remove cartões órfãos cujo baralho foi excluído", () => {
    const local = flattenLocalState(makeLocalState());
    local.graves.push({ id: "labor-law", type: "deck", deletedAt: "2026-01-05T00:00:00.000Z" });

    const merged = mergeState(local, { decks: [], cards: [], ratings: [], graves: [] });
    expect(merged.decks).toHaveLength(0);
    expect(merged.cards).toHaveLength(0);
  });
});

describe("planRemoteWrites", () => {
  it("só inclui registros que diferem do que já está remoto", () => {
    const local = flattenLocalState(makeLocalState());
    const remote = flattenLocalState(makeLocalState());
    const merged = mergeState(local, remote);
    expect(planRemoteWrites(merged, remote).cards).toHaveLength(0);

    local.cards[0].back = "Resposta 1 (editada)";
    local.cards[0].updatedAt = "2026-02-01T00:00:00.000Z";
    const mergedAfterEdit = mergeState(local, remote);
    const plan = planRemoteWrites(mergedAfterEdit, remote);
    expect(plan.cards.map((card) => card.id)).toEqual(["card-1"]);
  });
});
