export const OFFICIAL_EDITAL_URL = 'https://www.in.gov.br/web/dou/-/edital-n-1/2026-739927397';
export const OFFICIAL_EDITAL_SOURCE = `Edital nº 1/2026 TRT-4 AJAJ · publicado em 22/10/2026 · ${OFFICIAL_EDITAL_URL}`;

export type OfficialTopic = { name: string; legalBasis?: string; priority: 'A'|'B'|'C' };
export type OfficialSubject = { id: string; name: string; group: 'Conhecimentos Gerais'|'Conhecimentos Específicos'; topics: OfficialTopic[] };
const t = (name:string, priority:'A'|'B'|'C'='B', legalBasis?:string): OfficialTopic => ({ name, priority, legalBasis });

export const OFFICIAL_EDITAL_2026: OfficialSubject[] = [
  { id:'portuguese', name:'Língua Portuguesa', group:'Conhecimentos Gerais', topics:[
    t('Redação oficial','B'), t('Ortografia e acentuação','B'), t('Crase','A'), t('Compreensão, interpretação e contexto histórico','A'),
    t('Denotação, conotação, intertextualidade e figuras de linguagem','B'), t('Discurso direto, indireto e indireto livre','B'),
    t('Morfossintaxe e formação de palavras','A'), t('Sinonímia e antonímia','C'), t('Pontuação','A'), t('Pronomes','A'),
    t('Concordância nominal e verbal','A'), t('Flexão nominal e verbal; vozes verbais','B'), t('Correlação de tempos e modos verbais','B'),
    t('Regência nominal e verbal','A'), t('Coordenação, subordinação e conectivos','A'), t('Transformação e equivalência de estruturas','A'),
  ]},
  { id:'math-logic', name:'Matemática e Raciocínio Lógico', group:'Conhecimentos Gerais', topics:[
    t('Relações arbitrárias e dedução lógica','A'), t('Raciocínio verbal, matemático e sequencial','A'), t('Orientação espacial e temporal; formação de conceitos','B'),
    t('Hipóteses e conclusões válidas','A'), t('Números inteiros e racionais; operações e expressões','B'), t('Múltiplos e divisores','C'), t('Frações','B'),
    t('Razões, proporções e divisão proporcional','A'), t('Regra de três e porcentagem','A'), t('Estatística descritiva: média, mediana, moda e dispersão','B'),
    t('Leitura de gráficos e tabelas','A'),
  ]},
  { id:'trt-legislation', name:'Noções de Legislação', group:'Conhecimentos Gerais', topics:[
    t('Política de sustentabilidade do Poder Judiciário','B','Resolução CNJ nº 400/2021'),
    t('Código de Conduta e Valores Éticos do TRT-4','A','Portaria GP.TRT4 nº 4.573/2023, compilada pela Portaria nº 2.808/2025'),
    t('Regimento Interno do TRT-4','A','Regimento atualizado até a RA nº 31/2026 e Assento Regimental nº 04/2026'),
    t('Prevenção à violência, ao assédio e à discriminação na Justiça do Trabalho','A','Resolução CSJT nº 360/2023'),
    t('Política de prevenção ao assédio e à discriminação no Poder Judiciário','A','Resolução CNJ nº 351/2020'),
  ]},
  { id:'human-rights', name:'Noções de Direitos Humanos', group:'Conhecimentos Gerais', topics:[
    t('Evolução, fundamentos, fontes, princípios e gerações de direitos humanos','A'), t('Interpretação de tratados e colisão entre direitos humanos','A'),
    t('Tratados de direitos humanos, Constituição e controle de convencionalidade','A'), t('Declaração Universal dos Direitos Humanos','A'),
    t('PIDCP e PIDESC e protocolos facultativos','B'), t('Convenções sobre discriminação racial e contra a mulher','A'),
    t('Convenções sobre criança e pessoa com deficiência','B'), t('Proteção do patrimônio, Declaração de Estocolmo e diversidade biológica','C'),
    t('Declaração da ONU sobre direitos dos povos indígenas','B'), t('Sistema Interamericano de Direitos Humanos','A'),
    t('Declaração Americana, Convenção Americana e Protocolo de San Salvador','A'), t('CIDH e Corte IDH: composição, atribuições e decisões','A'),
    t('Mecanismos nacionais e internacionais de proteção','A'), t('Grupos vulneráveis e vítimas de injustiças históricas','A'),
    t('Perspectiva de gênero no Poder Judiciário','A','Resolução CNJ nº 492/2023'), t('Equidade de raça, gênero e diversidade na Justiça do Trabalho','A','Resolução CSJT nº 368/2023'),
    t('Tribunal Penal Internacional e Estatuto de Roma','B','Decreto nº 4.388/2002'), t('Carta da ONU e Corte Internacional de Justiça','B','Decreto nº 19.841/1945'),
    t('Protocolos para atuação e julgamento na Justiça do Trabalho','A'),
  ]},
  { id:'informatics', name:'Noções de Informática', group:'Conhecimentos Gerais', topics:[
    t('Windows 10 e 11','B'), t('Google Workspace e Microsoft Office 365','A'), t('Google Drive: criação, edição, compartilhamento e permissões','A'),
    t('Agenda, Tarefas, Google Meet e Gmail','B'), t('Documentos Google','B'), t('Internet, intranet e redes de computadores','B'),
    t('Firefox, Chrome e Edge','B'), t('Mecanismos de busca','C'), t('Arquivos, pastas e programas','B'),
    t('Segurança da informação, malware e ferramentas de proteção','A'), t('Autenticação de dois fatores e gestão de senhas','A'),
  ]},
  { id:'constitutional', name:'Direito Constitucional', group:'Conhecimentos Específicos', topics:[
    t('Aplicabilidade, interpretação, vigência e eficácia das normas constitucionais','A'), t('Controle difuso e concentrado; ADI, ADC e ADPF','A'),
    t('Princípios fundamentais','A'), t('Direitos e garantias fundamentais','A'), t('Direitos sociais','A'), t('Nacionalidade','B'),
    t('Direitos políticos e partidos políticos','B'), t('Organização político-administrativa e intervenção','B'),
    t('Administração Pública e servidores públicos','A'), t('Poder Executivo','B'), t('Poder Legislativo, processo legislativo e fiscalização','B'),
    t('Poder Judiciário, STF, CNJ e STJ','A'), t('Justiça do Trabalho e CSJT','A'), t('Funções essenciais à Justiça','B'),
  ]},
  { id:'administrative', name:'Direito Administrativo', group:'Conhecimentos Específicos', topics:[
    t('Administração Pública, regime jurídico e princípios','A'), t('LINDB aplicada à Administração','B','Decreto-Lei nº 4.657/1942'),
    t('Poderes administrativos, deveres e abuso de poder','A'), t('Crimes de abuso de autoridade','B','Lei nº 13.869/2019'),
    t('Atos administrativos','A'), t('Processo administrativo federal','A','Lei nº 9.784/1999'), t('Controle da Administração Pública','A'),
    t('Licitações e contratos administrativos','A','Lei nº 14.133/2021'), t('Parcerias com o terceiro setor','B','Lei nº 13.019/2014'),
    t('Serviços públicos e direitos dos usuários','B'), t('Concessão e permissão','B','Lei nº 8.987/1995'), t('Parcerias público-privadas','C','Lei nº 11.079/2004'),
    t('Agentes públicos e regime constitucional','A'), t('Regime jurídico dos servidores federais','A','Lei nº 8.112/1990'),
    t('Carreiras do Poder Judiciário Federal','B','Lei nº 11.416/2006'), t('Responsabilidade dos agentes e processo disciplinar','A'),
    t('Responsabilidade extracontratual do Estado','A'), t('Bens públicos','B'), t('Lei de Acesso à Informação','B','Lei nº 12.527/2011'),
    t('Lei Geral de Proteção de Dados','A','Lei nº 13.709/2018'),
  ]},
  { id:'labor-law', name:'Direito do Trabalho', group:'Conhecimentos Específicos', topics:[
    t('Princípios, fontes e direitos constitucionais dos trabalhadores','A'), t('Relação de trabalho e relação de emprego','A'),
    t('Trabalho autônomo, eventual, temporário, avulso e intermitente','A'), t('Empregado, empregador e poderes empregatícios','A'),
    t('Grupo econômico, sucessão e responsabilidades','A'), t('Contrato individual, alteração, suspensão e interrupção','A'),
    t('Extinção do contrato, justas causas e despedida coletiva','A'), t('Aviso prévio','A'), t('Estabilidades e garantias provisórias','A'),
    t('Duração, jornada, descansos e compensação','A'), t('Salário, remuneração, 13º e equiparação','A'), t('Férias','A'), t('Arbitragem','B'),
    t('FGTS','A'), t('Prescrição e decadência','A'), t('Segurança e medicina do trabalho','B'), t('Proteção da mulher, gestante e menor','A'),
    t('Direito coletivo, liberdade e organização sindical','A'), t('Convenções e acordos coletivos','A'), t('Greve e serviços essenciais','B'),
    t('Comissões de Conciliação Prévia; renúncia e transação','B'), t('Teletrabalho','A'), t('Dano moral e material','A'),
    t('Precedentes, súmulas, OJs e atos do TST','A'), t('Reforma Trabalhista','A','Lei nº 13.467/2017'), t('Repercussão geral trabalhista no STF','A'),
  ]},
  { id:'labor-procedure', name:'Direito Processual do Trabalho', group:'Conhecimentos Específicos', topics:[
    t('Organização e competência da Justiça do Trabalho','A'), t('Serviços auxiliares e oficiais de justiça','B'), t('Peritos, honorários e gratuidade','A'),
    t('Ministério Público do Trabalho','B'), t('Princípios e aplicação subsidiária do CPC','A'), t('Prescrição, decadência e prescrição intercorrente','A'),
    t('Atos, termos, prazos, distribuição e valor da causa','A'), t('Custas, emolumentos e isenções','A'), t('Partes, procuradores e jus postulandi','A'),
    t('Litisconsórcio, assistência, substituição e representação','A'), t('Honorários advocatícios','A'), t('Nulidades e exceções','A'),
    t('Audiência, conciliação, notificação, arquivamento, revelia e confissão','A'), t('Provas','A'),
    t('Reclamação trabalhista; procedimentos ordinário e sumaríssimo','A'), t('Inquérito, ação rescisória, mandado de segurança e ação civil pública','A'),
    t('Sentença, coisa julgada e liquidação','A'), t('Dissídios coletivos','B'), t('Execução trabalhista e IDPJ','A'),
    t('Garantia, penhora e impenhorabilidade','A'), t('Embargos, impugnação e embargos de terceiro','A'), t('Expropriação e custas na execução','A'),
    t('Recursos no processo do trabalho','A'), t('PJe e atos eletrônicos','B'), t('Precedentes obrigatórios, súmulas, OJs e atos do TST','A'),
    t('Reforma Trabalhista','A','Lei nº 13.467/2017'), t('Repercussão geral e protocolos de julgamento','A'),
  ]},
  { id:'civil-law', name:'Direito Civil', group:'Conhecimentos Específicos', topics:[
    t('Pessoa natural, personalidade, capacidade e direitos da personalidade','A'), t('Pessoas jurídicas e domicílio','B'),
    t('Bens, afetação e desafetação','B'), t('Negócio jurídico: elementos, defeitos e invalidade','A'), t('Prescrição, decadência e prova','A'),
    t('Obrigações e contratos','A'), t('Vícios redibitórios e evicção','B'), t('Responsabilidade civil','A'), t('Direito de empresa e nome empresarial','C'),
    t('Posse e função socioambiental','B'), t('Propriedade e função social','B'), t('Vizinhança, condomínio e propriedade fiduciária','B'),
    t('Direitos reais sobre coisa alheia e aquisição','B'), t('Garantias reais','B'), t('Casamento, união estável e regimes de bens','B'),
    t('Filiação, poder familiar e proteção dos filhos','B'), t('Sucessão, inventário e partilha','B'),
  ]},
  { id:'civil-procedure', name:'Direito Processual Civil', group:'Conhecimentos Específicos', topics:[
    t('Jurisdição, ação e condições da ação','A'), t('Magistratura e auxiliares; MP, Defensoria e Advocacia','B'),
    t('Partes, procuradores, litisconsórcio e intervenção de terceiros','A'), t('Competência e declaração de incompetência','A'),
    t('Atos processuais, prazos, comunicação, nulidades e preclusão','A'), t('Formação, suspensão e extinção do processo','B'),
    t('Petição inicial, pedido e valor da causa','A'), t('Contestação, exceções, reconvenção e revelia','A'), t('Tutela provisória','A'),
    t('Julgamento conforme o estado do processo','B'), t('Provas e ônus da prova','A'), t('Audiências','B'), t('Sentença e coisa julgada','A'),
    t('Liquidação, cumprimento e impugnação','A'), t('Ação rescisória','B'), t('Recursos','A'), t('Execução e embargos à execução','A'),
    t('Procedimentos especiais','B'), t('Mandado de segurança individual e coletivo','B'), t('Ação civil pública','B','Lei nº 7.347/1985'),
    t('Juizados Especiais Cíveis e Criminais','C','Lei nº 9.099/1995'), t('Mediação','C','Lei nº 13.140/2015'),
  ]},
];

export const OFFICIAL_TOPIC_COUNT = OFFICIAL_EDITAL_2026.reduce((sum, subject) => sum + subject.topics.length, 0);
