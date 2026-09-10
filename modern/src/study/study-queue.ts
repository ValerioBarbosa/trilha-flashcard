import type { CardRow, LatestReview } from './domain-repository';

export type Scope = 'all' | 'new' | 'due' | 'wrong';

export const SCOPE_LABEL: Record<Scope, string> = {
  all: 'Todos os cartões',
  new: 'Ainda não estudados',
  due: 'Vencidos para revisão',
  wrong: 'Errados / difíceis',
};

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function filterByScope(
  cards: CardRow[],
  reviewMap: Map<string, LatestReview>,
  errorCardIds: Set<string>,
  scope: Scope,
  priority: '' | 'A' | 'B' | 'C',
  now: number = Date.now(),
): CardRow[] {
  let pool = cards;
  if (priority) pool = pool.filter((item) => item.priority === priority);
  if (scope === 'new') pool = pool.filter((item) => !reviewMap.has(item.id));
  if (scope === 'due') pool = pool.filter((item) => {
    const review = reviewMap.get(item.id);
    return Boolean(review) && new Date(review!.due_at).getTime() <= now;
  });
  if (scope === 'wrong') pool = pool.filter((item) => errorCardIds.has(item.id));
  return pool;
}

export function buildStudyQueue(
  cards: CardRow[],
  reviewMap: Map<string, LatestReview>,
  errorCardIds: Set<string>,
  options: { scope: Scope; priority: '' | 'A' | 'B' | 'C'; count: number; now?: number },
): CardRow[] {
  const pool = filterByScope(cards, reviewMap, errorCardIds, options.scope, options.priority, options.now);
  return shuffle(pool).slice(0, Math.max(1, options.count));
}
