import { describe, it, expect } from 'vitest';
import { officialLawSources } from '../modern/src/edital/law-sources';

describe('fontes oficiais da Lei Seca', () => {
  it('reconhece referências múltiplas e fontes fixas', () => {
    expect(officialLawSources('CLT, art. 769; CPC, art. 15').map(s => s.name)).toEqual(['CLT','CPC']);
  });
  it('reconhece referências com e sem pontuação', () => {
    expect(officialLawSources('Lei 8112/1990')).toEqual(officialLawSources('Lei 8.112/1990'));
    expect(officialLawSources('LGPD')[0]?.url).toContain('l13709compilado.htm');
  });
  it('não gera URL a partir de referência arbitrária', () => {
    expect(officialLawSources('https://example.com')).toEqual([]);
    expect(officialLawSources('STF STF')).toHaveLength(1);
  });
});
