import { describe, it, expect } from 'vitest';
import { V43_ADVANCED_CARDS } from '../modern/src/study/v43-advanced';
import { V4_NEW_CONTENT_CARDS } from '../modern/src/study/v4-supplement';

describe('V4.3 advanced flashcards', () => {
  it('preserves unique IDs across both layers', () => {
    expect(V43_ADVANCED_CARDS.length).toBeGreaterThanOrEqual(12);
    const ids = [...V4_NEW_CONTENT_CARDS, ...V43_ADVANCED_CARDS].map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('provides concrete cases with legal references and traps', () => {
    expect(V43_ADVANCED_CARDS.every(c => c.front.length > 35 && c.back.length > 35 && c.legalBasis && c.trap && c.topic)).toBe(true);
  });
});
