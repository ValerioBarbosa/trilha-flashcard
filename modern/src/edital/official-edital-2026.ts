import matrix from './official-edital-v4-data.json';

export const OFFICIAL_EDITAL_URL = 'https://www.in.gov.br/web/dou/-/edital-n-1/2026-739927397';
export const OFFICIAL_EDITAL_SOURCE = `Edital nº 1/2026 TRT-4 AJAJ · Matriz V4 · Anexo II · ${OFFICIAL_EDITAL_URL}`;

export type OfficialTopic = { id: string; name: string; legalBasis?: string; priority: 'A'|'B'|'C' };
export type OfficialSubject = { id: string; name: string; group: 'Conhecimentos Gerais'|'Conhecimentos Específicos'; topics: OfficialTopic[] };

const SUBJECTS: Record<string, { name: string; group: OfficialSubject['group'] }> = {
  portuguese: { name:'Língua Portuguesa', group:'Conhecimentos Gerais' },
  'math-logic': { name:'Matemática e Raciocínio Lógico', group:'Conhecimentos Gerais' },
  'trt-legislation': { name:'Noções de Legislação', group:'Conhecimentos Gerais' },
  'human-rights': { name:'Noções de Direitos Humanos', group:'Conhecimentos Gerais' },
  informatics: { name:'Noções de Informática', group:'Conhecimentos Gerais' },
  constitutional: { name:'Direito Constitucional', group:'Conhecimentos Específicos' },
  administrative: { name:'Direito Administrativo', group:'Conhecimentos Específicos' },
  'labor-law': { name:'Direito do Trabalho', group:'Conhecimentos Específicos' },
  'labor-procedure': { name:'Direito Processual do Trabalho', group:'Conhecimentos Específicos' },
  'civil-law': { name:'Direito Civil', group:'Conhecimentos Específicos' },
  'civil-procedure': { name:'Direito Processual Civil', group:'Conhecimentos Específicos' },
};

function specificBasis(name: string): string | undefined {
  const cites = name.match(/(?:Resolução (?:CNJ|CSJT) nº [\d.]+\/\d{4}|Lei nº [\d.]+\/\d{4}|Decreto(?:-Lei)? nº [\d.]+\/\d{4}|Portaria [^)]{0,100}\/\d{4}|RA nº 31\/2026|Assento Regimental nº 04\/2026)/gi);
  return cites?.join('; ') || undefined;
}

export const OFFICIAL_EDITAL_2026: OfficialSubject[] = Object.entries(SUBJECTS).map(([id, subject]) => ({
  id, ...subject,
  topics: matrix.rows
    .filter((row) => row.disciplineId === id)
    .map((row) => ({
      id: row.id,
      name: row.name,
      priority: row.priority as OfficialTopic['priority'],
      legalBasis: specificBasis(row.name),
    })),
}));

export const OFFICIAL_TOPIC_COUNT = matrix.rows.length;
export const OFFICIAL_SUBJECT_COUNT = OFFICIAL_EDITAL_2026.length;
export const OFFICIAL_EDITAL_VERSION = matrix.version;
export const OFFICIAL_TOPIC_IDS = new Set(matrix.rows.map((row) => row.id));
export const OFFICIAL_MATRIX_TOPIC_NAMES = new Map(OFFICIAL_EDITAL_2026.map((subject) => [
  subject.id, new Set(subject.topics.map((topic) => topic.name)),
]));
