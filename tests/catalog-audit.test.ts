import { describe, expect, it } from 'vitest';
import { buildCatalogAudit, type AuditCard } from '../modern/src/study/catalog-audit';
import type { DeckRow, SubjectRow, TopicRow } from '../src/features/study/domain-repository';

const subject: SubjectRow = {
  id:'sub-pt', name:'Língua Portuguesa', slug:'lingua-portuguesa',
  priority:'A', weight:null, sort_order:0,
};
const official: TopicRow = {
  id:'official-crase', subject_id:subject.id, parent_id:null,
  name:'Emprego do sinal indicativo de crase', slug:'emprego-do-sinal-indicativo-de-crase',
  edital_text:null, legal_basis:null, priority:'A', sort_order:0,
};
const legacy: TopicRow = {
  id:'legacy-crase', subject_id:subject.id, parent_id:null,
  name:'Sinal indicativo de crase', slug:'sinal-indicativo-de-crase',
  edital_text:null, legal_basis:null, priority:'A', sort_order:0,
};
const unrelated: TopicRow = {
  id:'legacy-other', subject_id:subject.id, parent_id:null,
  name:'Gramática', slug:'gramatica',
  edital_text:null, legal_basis:null, priority:null, sort_order:0,
};
const complementary: TopicRow = {
  id:'complementary', subject_id:subject.id, parent_id:null,
  name:'Jurisprudência prioritária STF/TST', slug:'jurisprudencia-prioritaria',
  edital_text:null, legal_basis:null, priority:null, sort_order:0,
};
const builtin: DeckRow = {
  id:'deck-builtin', profile_id:'profile', subject_id:subject.id,
  name:'Língua Portuguesa',slug:'portuguese',description:null,source:null,
  is_builtin:true,is_archived:false,
};
const personal: DeckRow = { ...builtin, id:'deck-personal',is_builtin:false };
function card(overrides: Partial<AuditCard> = {}): AuditCard {
  return {
    id:'card-1',deck_id:builtin.id,subject_id:subject.id,
    topic_id:legacy.id,legacy_id:'card-trt4-old-1',
    front:'Quando se usa crase?',back:'Na fusão de preposição e artigo.',
    card_type:'Flashcard',legal_basis:'Gramática',source:null,tags:[],
    ...overrides,
  };
}

describe('auditoria V4 conservadora', () => {
  it('distingue a presença da matriz de conteúdo realmente vinculado', () => {
    const report = buildCatalogAudit([subject],[official,legacy],[builtin],[card()]);
    expect(report.expectedTopics).toBe(285);
    expect(report.registeredTopics).toBe(1);
    expect(report.coveredTopics).toBe(0);
    expect(report.outsideOfficialMatrix).toBe(1);
    expect(report.safeMappings).toHaveLength(1);
    expect(report.safeMappings[0]).toMatchObject({
      fromId:legacy.id,toId:official.id,match:'título contido',cardIds:['card-1'],
    });
    expect(report.potentialCoveredAfterMapping).toBe(1);
  });

  it('não sugere mudanças para baralho pessoal nem assunto ambíguo', () => {
    const cards = [
      card({id:'personal',deck_id:'deck-personal'}),
      card({id:'ambiguous',topic_id:unrelated.id,front:'Qual a regra?',legacy_id:'card-trt4-old-2'}),
    ];
    const report = buildCatalogAudit([subject],[official,legacy,unrelated],[builtin,personal],cards);
    expect(report.safeMappings).toHaveLength(0);
    expect(report.requiresHumanReview).toBe(2);
  });

  it('exclui roteiro e jurisprudência complementar dos indicadores de lacunas', () => {
    const cards = [
      card({id:'regular',topic_id:official.id}),
      card({id:'guide',topic_id:legacy.id,card_type:'Roteiro de estudo'}),
      card({id:'law',topic_id:official.id,card_type:'Lei seca'}),
      card({id:'juris',topic_id:complementary.id,front:'Tema diferente'}),
    ];
    const report = buildCatalogAudit([subject],[official,legacy,complementary],[builtin],cards);
    expect(report.coveredTopics).toBe(1);
    expect(report.lawCards).toBe(1);
    expect(report.outsideOfficialMatrix).toBe(0);
    expect(report.safeMappings).toHaveLength(0);
  });

  it('aponta equivalência visual sem classificar como duplicidade confirmada no banco', () => {
    const cards = [
      card({id:'a',topic_id:official.id,front:'Texto   da questão',back:'Resposta A'}),
      card({id:'b',topic_id:official.id,front:'Texto da questão',back:'Resposta A'}),
    ];
    const report = buildCatalogAudit([subject],[official],[builtin],cards);
    expect(report.potentialDuplicates).toBe(1);
    expect(report.contentKeyCollisions).toBe(0);
  });
});
