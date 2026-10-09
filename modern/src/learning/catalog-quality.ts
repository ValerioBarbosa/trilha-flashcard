import { SOURCES } from './practice-bank';

export type CatalogEntry = {
  id: string; discipline: string; topic?: string; subtopic?: string; front: string; back: string;
  type?: string; tags?: string[]; sourceLayer?: string; complement?: string; legalBasis?: string;
};

/** Preserve IDs and source layers so existing reviews and matrix links remain valid. */
export function qualifyCatalog<T extends CatalogEntry>(cards: T[]): T[] {
  return cards.map((card) => {
    const guide = card.sourceLayer === 'Camada 1 - 406 cartões' || card.sourceLayer === 'Camada 3 - Fechamento do edital';
    const updated = guide ? { ...card, type: card.type === 'Lei seca' ? 'Lei seca' : 'Roteiro de estudo', tags: [...(card.tags || []), 'roteiro-de-estudo'], complement: 'Roteiro de leitura da matriz. Não é transcrição da norma nem cartão de conteúdo; não entra na revisão ou no indicador de recuperação.' } : { ...card };
    if (card.type === 'Caso prático') {
      updated.type = 'Revisão de regra';
      updated.front = `Qual regra se aplica a ${card.subtopic || card.topic}?`;
    }
    if (card.discipline === 'labor-procedure' && card.subtopic === 'responsabilidade pelos honorários periciais') {
      const rule = 'A sucumbência no objeto da perícia define a responsabilidade, mas o beneficiário da justiça gratuita não pode ser obrigado a custear a perícia com créditos obtidos em juízo. Na hipótese de beneficiário sucumbente, o custeio cabe à União, conforme a disciplina aplicável e a ADI 5.766.';
      updated.back = card.type === 'Certo ou errado' ? `Errado na parte que impõe pagamento ao beneficiário com créditos judiciais. ${rule}` : rule;
      updated.front = card.type === 'Certo ou errado' ? 'Certo ou errado: o beneficiário da justiça gratuita que perde no objeto da perícia deve pagar os honorários usando créditos obtidos no processo.' : card.front;
      updated.legalBasis = 'CLT, art. 790-B, conforme STF ADI 5.766; TST Súmula 457';
    }
    return updated as T;
  });
}

export const JURISPRUDENCE_NOTES: Record<string, { text: string; alert: string; source: string }> = {
  'TST Súmulas 6, 51 e 85': {
    text: 'Equiparação: use os requisitos atuais do art. 461 da CLT, inclusive mesmo estabelecimento e diferenças máximas de quatro anos no empregador e dois na função. Regulamento: a Súmula 51 distingue empregados admitidos antes e depois da alteração. Compensação: confronte a Súmula 85 com os arts. 59 e 59-B e com o período do contrato.',
    alert: 'A Resolução 225/2025 cancelou os itens I, II, VI, alínea b, e X da Súmula 6. Não memorize o verbete antigo inteiro como vigente. A Súmula 85 exige análise temporal; não foi integralmente cancelada por essa resolução.', source:SOURCES.cancelamentos },
  'TST Súmulas 100, 128 e 245': {
    text: 'A Súmula 100 trata do termo inicial do prazo decadencial da ação rescisória e suas hipóteses. A Súmula 128 exige depósito a cada recurso até atingir a condenação, observadas as situações próprias da execução e da condenação solidária. A Súmula 245 vincula depósito e comprovação ao prazo recursal; interposição antecipada não encurta esse prazo.',
    alert: 'Separe prazo de recurso, custas e depósito recursal. Verifique isenções e reduções na CLT, art. 899, antes de aplicar regra geral.', source:SOURCES.tst },
  'TST Súmulas 214 e 414': {
    text: 'A regra é a irrecorribilidade imediata das decisões interlocutórias no processo trabalhista, com exceções da Súmula 214. Pela Súmula 414, tutela concedida na sentença é atacada pelo recurso próprio; tutela anterior à sentença pode admitir mandado de segurança na ausência de recurso próprio.',
    alert: 'O momento da tutela e a existência de recurso próprio mudam o instrumento. Não trate todo ato interlocutório como recorrível nem todo ato como impugnável por mandado de segurança.', source:SOURCES.tst },
  'TST Súmulas 331 e 338': {
    text: 'Terceirização: não use a distinção atividade-meio/atividade-fim para presumir ilicitude. Responsabilidade exige distinguir tomador privado e Administração Pública. Jornada: ausência injustificada de controles obrigatórios ou registros invariáveis pode gerar presunção relativa, conforme as hipóteses da Súmula 338.',
    alert: 'O item I da Súmula 331 foi cancelado pela Resolução 225/2025. A obrigação legal atual de registro do art. 74, § 2º, da CLT é para estabelecimentos com mais de 20 trabalhadores; não copie automaticamente o número histórico do verbete.', source:SOURCES.cancelamentos },
  'TST Súmulas 422, 425 e 463': {
    text: 'A Súmula 422 exige impugnação dos fundamentos da decisão recorrida, observadas suas ressalvas. A Súmula 425 limita jus postulandi a Varas e TRTs e exclui rescisória, cautelar, mandado de segurança e recursos ao TST. A Súmula 463 diferencia gratuidade da pessoa natural e da jurídica; a declaração da natural pode ser apresentada por advogado com poderes específicos.',
    alert: 'Para pessoa jurídica, a mera declaração não basta: é necessária demonstração da impossibilidade de arcar com despesas. Verifique também precedentes atuais sobre gratuidade e oportunidade de comprovação.', source:SOURCES.tst },
  'STF Súmula Vinculante 10': {
    text: 'A reserva de plenário também é violada quando órgão fracionário afasta a incidência de lei ou ato normativo por fundamento constitucional, mesmo sem declarar expressamente sua inconstitucionalidade. Observe CF, art. 97, e a dispensa de nova submissão nas hipóteses do CPC, art. 949, parágrafo único.',
    alert: 'Distinguir afastamento por inconstitucionalidade de interpretação ou não incidência por outro fundamento.', source:SOURCES.cf },
  'STF ADPF 324 + RE 958.252': {
    text: 'A terceirização ou outra divisão de trabalho entre pessoas jurídicas distintas é lícita independentemente da atividade desenvolvida, mantida a responsabilidade subsidiária da contratante nos termos da tese. Isso não transforma fraude concreta em conduta válida.',
    alert: 'Não confunda licitude da terceirização com ausência de responsabilidade ou de exame de fraude.', source:'https://portal.stf.jus.br/jurisprudenciaRepercussao/verAndamentoProcesso.asp?incidente=4952236&numeroProcesso=958252&classeProcesso=RE&numeroTema=725' },
  'STF ADI 5.766': {
    text: 'A gratuidade não pode ser afastada apenas porque o trabalhador obteve créditos judiciais. Na perícia, observe o custeio pela União na hipótese aplicável. Honorários advocatícios do beneficiário têm disciplina de exigibilidade suspensa, sem desconto automático dos créditos. A regra sobre custas por ausência injustificada do reclamante à audiência não foi afastada pelo julgamento.',
    alert: 'Separe honorários periciais, honorários advocatícios e custas por ausência à audiência. Não conclua que toda sucumbência ou toda cobrança foi eliminada.', source:'https://portal.stf.jus.br/processos/detalhe.asp?incidente=5250582' },
  'STF ADC 58/59': {
    text: 'O julgamento estabeleceu parâmetros de atualização dos créditos trabalhistas e modulação. Para resolver questão, identifique período, fase processual, coisa julgada e incidência de alterações legislativas posteriores antes de escolher índice e juros.',
    alert: 'Roteiro de atualização: o número da ADC não basta para definir o cálculo atual. Consulte decisão e precedentes posteriores, inclusive a aplicação da Lei 14.905/2024. Este item não oferece fórmula automática.', source:'https://portal.stf.jus.br/processos/detalhe.asp?incidente=5526245' },
  'STF Tema 1.046': {
    text: 'Acordos e convenções coletivos podem limitar ou afastar direitos trabalhistas mediante adequação setorial negociada, sem explicitação de vantagens compensatórias, desde que respeitados direitos absolutamente indisponíveis.',
    alert: 'Identifique o direito concretamente negociado e os limites de indisponibilidade; não transforme a tese em autorização irrestrita.', source:'https://portal.stf.jus.br/jurisprudenciaRepercussao/verAndamentoProcesso.asp?incidente=5415427&numeroProcesso=1121633&classeProcesso=ARE&numeroTema=1046' },
};
