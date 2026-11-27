import { describe, it, expect } from 'vitest';
import { highlightLawText } from '../modern/src/edital/law-highlights';

describe('destaques da Lei Seca', () => {
  it('preserva integralmente o texto e as quebras de linha', () => {
    const original = 'Art. 1º\nÉ vedado agir, salvo autorização em 15 dias úteis.';
    expect(highlightLawText(original).map(s => s.text).join('')).toBe(original);
  });
  it('identifica as cinco categorias lexicais', () => {
    const original = 'Compete ao órgão decidir em 48 horas; é vedado agir, salvo quando é assegurado o direito.';
    expect(highlightLawText(original).filter(s => s.kind).map(s => s.kind)).toEqual(['competencia','prazo','vedacao','excecao','direito']);
  });
  it('não altera texto sem expressões detectadas nem texto vazio', () => {
    expect(highlightLawText('Texto comum.')).toEqual([{ text: 'Texto comum.' }]);
    expect(highlightLawText('')).toEqual([]);
  });
});
