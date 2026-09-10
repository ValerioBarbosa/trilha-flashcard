import { describe, expect, it } from 'vitest';
import { buildStudyQueue, filterByScope, shuffle } from '../modern/src/study/study-queue';
import type { CardRow, LatestReview } from '../modern/src/study/domain-repository';

function makeCard(id: string, priority: string | null = null): CardRow {
  return {
    id,
    deck_id: 'deck-1',
    subject_id: 'subject-1',
    topic_id: null,
    front: `Pergunta ${id}`,
    back: `Resposta ${id}`,
    card_type: null,
    legal_basis: null,
    example: null,
    complement: null,
    pitfall: null,
    mnemonic: null,
    priority,
    difficulty: null,
    tags: [],
  };
}

const NOW = new Date('2026-09-10T12:00:00Z').getTime();

describe('filterByScope', () => {
  const cards = [makeCard('new-1'), makeCard('due-1'), makeCard('future-1'), makeCard('wrong-1', 'A')];
  const reviewMap = new Map<string, LatestReview>([
    ['due-1', { rating: 3, due_at: new Date(NOW - 60_000).toISOString() }],
    ['future-1', { rating: 4, due_at: new Date(NOW + 30 * 86_400_000).toISOString() }],
    ['wrong-1', { rating: 1, due_at: new Date(NOW).toISOString() }],
  ]);
  const errorCardIds = new Set(['wrong-1']);

  it('escopo "new" traz só cartões sem nenhuma revisão registrada', () => {
    const result = filterByScope(cards, reviewMap, errorCardIds, 'new', '', NOW);
    expect(result.map((c) => c.id)).toEqual(['new-1']);
  });

  it('escopo "due" traz só cartões cujo due_at já passou, ignorando os ainda não vencidos', () => {
    const result = filterByScope(cards, reviewMap, errorCardIds, 'due', '', NOW);
    expect(result.map((c) => c.id).sort()).toEqual(['due-1', 'wrong-1']);
  });

  it('escopo "wrong" traz só cartões com pendência aberta no caderno de erros', () => {
    const result = filterByScope(cards, reviewMap, errorCardIds, 'wrong', '', NOW);
    expect(result.map((c) => c.id)).toEqual(['wrong-1']);
  });

  it('escopo "all" combinado com prioridade filtra só por prioridade', () => {
    const result = filterByScope(cards, reviewMap, errorCardIds, 'all', 'A', NOW);
    expect(result.map((c) => c.id)).toEqual(['wrong-1']);
  });
});

describe('buildStudyQueue', () => {
  it('embaralha e limita a quantidade pedida', () => {
    const cards = Array.from({ length: 10 }, (_, index) => makeCard(`c${index}`));
    const queue = buildStudyQueue(cards, new Map(), new Set(), { scope: 'all', priority: '', count: 3, now: NOW });
    expect(queue).toHaveLength(3);
    expect(new Set(queue.map((c) => c.id)).size).toBe(3);
  });

  it('nunca devolve menos de 1 cartão quando count é zero ou negativo, se houver cartões', () => {
    const cards = [makeCard('a')];
    const queue = buildStudyQueue(cards, new Map(), new Set(), { scope: 'all', priority: '', count: 0, now: NOW });
    expect(queue).toHaveLength(1);
  });
});

describe('shuffle', () => {
  it('preserva os mesmos elementos, só reordena', () => {
    const items = [1, 2, 3, 4, 5];
    const result = shuffle(items);
    expect(result).not.toBe(items);
    expect([...result].sort()).toEqual(items);
  });
});
