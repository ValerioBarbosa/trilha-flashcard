import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PRACTICE_BANK, scorePractice } from '../modern/src/learning/practice-bank';
import { qualifyCatalog, JURISPRUDENCE_NOTES } from '../modern/src/learning/catalog-quality';
import { isStudyContent } from '../src/features/study/card-purpose';

const original = JSON.parse(Array.from({length:6},(_,i) => readFileSync(`modern/public/data/trt4-ajaj-v3-1077/part-${String(i+1).padStart(2,'0')}.txt`,'utf8')).join('\n')).cards;
describe('qualidade e honestidade do material de estudo', () => {
  it('mantém identidade e tópicos; exclui todos os roteiros da recuperação ativa', () => {
    const updated = qualifyCatalog(original);
    expect(updated.map((card) => card.id)).toEqual(original.map((card: any) => card.id));
    expect(updated.map((card) => card.topic)).toEqual(original.map((card: any) => card.topic));
    const guides = updated.filter((card) => card.sourceLayer !== 'Camada 2 - 500 cartões');
    expect(guides).toHaveLength(577);
    expect(guides.every((card) => !isStudyContent(card))).toBe(true);
  });
  it('não chama de caso concreto uma pergunta sem fatos; corrige honorários periciais', () => {
    const updated = qualifyCatalog(original);
    expect(updated.some((card) => card.type === 'Caso prático')).toBe(false);
    const pericia = updated.filter((card) => card.subtopic === 'responsabilidade pelos honorários periciais');
    expect(pericia).toHaveLength(4);
    expect(pericia.every((card) => card.back.includes('União') && card.legalBasis?.includes('5.766'))).toBe(true);
  });
  it('identifica cancelamento parcial sem declarar toda a súmula cancelada', () => {
    expect(JURISPRUDENCE_NOTES['TST Súmulas 6, 51 e 85'].alert).toContain('VI, alínea b');
    expect(JURISPRUDENCE_NOTES['TST Súmulas 331 e 338'].alert).toContain('item I');
  });
  it('oferece cinco alternativas, gabarito único, explicação e nove disciplinas', () => {
    expect(new Set(PRACTICE_BANK.map((question) => question.id)).size).toBe(PRACTICE_BANK.length);
    expect(new Set(PRACTICE_BANK.map((question) => question.discipline)).size).toBe(9);
    for (const question of PRACTICE_BANK) {
      expect(question.options).toHaveLength(5);
      expect(new Set(question.options).size).toBe(5);
      expect(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 5).toBe(true);
      expect(question.explanation.length).toBeGreaterThan(100);
      if (!['portuguese','math-logic'].includes(question.discipline)) expect(question.source).toMatch(/^https:\/\/(www\.planalto\.gov\.br|portal\.stf\.jus\.br)/);
    }
  });
  it('distingue ausência de tentativas de 0% e calcula só questões respondidas', () => {
    expect(scorePractice(new Map())).toEqual({total:0,correct:0,accuracy:null});
    const [a,b] = PRACTICE_BANK;
    expect(scorePractice(new Map([[a.id,a.answer],[b.id,(b.answer+1)%5]]))).toEqual({total:2,correct:1,accuracy:50});
  });
  it('casos têm fatos, comando e critérios de fundamentação', () => {
    const cases = PRACTICE_BANK.filter((question) => question.rubric);
    expect(cases.length).toBeGreaterThanOrEqual(8);
    expect(cases.every((question) => question.rubric!.length >= 3)).toBe(true);
    expect(cases.find((question) => question.id === 'lp-foro')?.statement).toContain('Canoas');
    expect(cases.find((question) => question.id === 'lt-intervalo')?.statement).toContain('40 minutos');
  });
});
