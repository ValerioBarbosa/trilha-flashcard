export type LawHighlightKind = 'prazo' | 'vedacao' | 'direito' | 'excecao' | 'competencia';
export type LawSegment = { text: string; kind?: LawHighlightKind };
export const LAW_HIGHLIGHT_LABELS: Record<LawHighlightKind, string> = {
  prazo: 'Prazo', vedacao: 'Vedação', direito: 'Direito ou permissão', excecao: 'Exceção', competencia: 'Competência',
};
// Indicadores lexicais, não classificação jurídica automática. Mantém todos os caracteres.
const patterns: Array<[LawHighlightKind, string]> = [
  ['prazo', String.raw`(?:\b\d+(?:[.,]\d+)?|\b(?:um|uma|dois|duas|três|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta|quarenta|sessenta|noventa|cento e vinte))\s+(?:dias(?:\s+(?:úteis|corridos))?|horas|meses|anos)\b`],
  ['vedacao', 'é vedad[oa]|são vedad[oa]s|não poderá|não poderão|não será permitido|é proibid[oa]'],
  ['direito', 'é assegurad[oa]|são assegurad[oa]s|tem direito|terá direito|é facultad[oa]'],
  ['excecao', 'ressalvad[oa]s?|salvo|exceto|sem prejuízo'],
  ['competencia', 'compete a[o]s?|compete à[s]?|é da competência'],
];
export function highlightLawText(text: string): LawSegment[] {
  const regex = new RegExp(patterns.map(([, source]) => '(' + source + ')').join('|'), 'giu');
  const segments: LawSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(regex)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: text.slice(last, index) });
    const group = match.slice(1).findIndex((value) => value !== undefined);
    segments.push({ text: match[0], kind: patterns[group]?.[0] });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}
