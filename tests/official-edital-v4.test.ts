import { describe, expect, it } from 'vitest';
import { OFFICIAL_EDITAL_2026, OFFICIAL_TOPIC_COUNT } from '../modern/src/edital/official-edital-2026';
import { V4_NEW_CONTENT_CARDS } from '../modern/src/study/v4-supplement';

describe('TRT-4 AJAJ V4 official syllabus', () => {
  it('keeps the exact 11 disciplines and 285 didactic syllabus cuts', () => {
    expect(OFFICIAL_EDITAL_2026).toHaveLength(11);
    expect(OFFICIAL_TOPIC_COUNT).toBe(285);
    expect(Object.fromEntries(OFFICIAL_EDITAL_2026.map((subject) => [subject.id, subject.topics.length]))).toEqual({
      portuguese:13, 'math-logic':12, 'trt-legislation':6,
      'human-rights':27, informatics:15, constitutional:20,
      administrative:44, 'labor-law':43, 'labor-procedure':44,
      'civil-law':33, 'civil-procedure':28,
    });
  });

  it('has unique syllabus identities and no missing topic labels', () => {
    const ids = OFFICIAL_EDITAL_2026.flatMap((subject) => subject.topics.map((topic) => topic.id));
    expect(new Set(ids).size).toBe(285);
    expect(OFFICIAL_EDITAL_2026.every((subject) => subject.topics.every((topic) => topic.name.trim().length > 3))).toBe(true);
  });

  it('assigns 173 substantive cards to existing official cuts, with no filler', () => {
    expect(V4_NEW_CONTENT_CARDS).toHaveLength(173);
    expect(new Set(V4_NEW_CONTENT_CARDS.map((card) => card.id)).size).toBe(173);
    expect(V4_NEW_CONTENT_CARDS.filter((card) => card.discipline === 'labor-procedure')).toHaveLength(44);
    expect(V4_NEW_CONTENT_CARDS.every((card) => {
      const subject = OFFICIAL_EDITAL_2026.find((item) => item.id === card.discipline);
      return Boolean(subject?.topics.some((topic) => topic.name === card.topic))
        && card.front.length > 20
        && card.back.length > 25
        && !card.front.startsWith('Tópico oficial:');
    })).toBe(true);
  });
});
