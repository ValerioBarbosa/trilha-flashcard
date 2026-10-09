/** Roteiros orientam leitura; não demonstram recuperação de conteúdo. */
export function isStudyContent(card: { card_type?: string | null; type?: string; tags?: string[] | null }) {
  const type = card.card_type ?? card.type;
  return type !== 'Roteiro de estudo' && type !== 'Lei seca' && !card.tags?.includes('roteiro-de-estudo');
}
