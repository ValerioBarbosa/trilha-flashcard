import type { SupabaseClient } from '@supabase/supabase-js';
import type { PracticeQuestion } from './practice-bank';

export type ExternalPracticeQuestion = PracticeQuestion & {
  origin: 'quest-api';
  externalId: string;
  board?: string;
  year?: number;
  exam?: string;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function firstString(row: UnknownRecord, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function firstNumber(row: UnknownRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function findQuestionArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = record(payload);
  if (!root) return [];
  for (const key of ['data','items','results','questoes','questions','rows']) {
    const value = root[key];
    if (Array.isArray(value)) return value;
    const nested = record(value);
    if (nested) {
      for (const nestedKey of ['data','items','results','questoes','questions','rows']) {
        if (Array.isArray(nested[nestedKey])) return nested[nestedKey] as unknown[];
      }
    }
  }
  return [];
}

function parseOptions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      const item = record(entry);
      return item ? firstString(item, ['text','texto','descricao','description','value','label','alternativa']) : '';
    }).filter(Boolean);
  }
  const item = record(value);
  if (item) {
    return ['A','B','C','D','E'].map((key) => {
      const option = item[key] ?? item[key.toLowerCase()];
      if (typeof option === 'string') return option.trim();
      const optionRow = record(option);
      return optionRow ? firstString(optionRow, ['text','texto','descricao','value','label']) : '';
    }).filter(Boolean);
  }
  return [];
}

function parseAnswer(value: unknown, optionCount: number): number {
  if (typeof value === 'number') {
    if (value >= 0 && value < optionCount) return value;
    if (value >= 1 && value <= optionCount) return value - 1;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    const letter = 'ABCDE'.indexOf(normalized[0] || '');
    if (letter >= 0 && letter < optionCount) return letter;
    const numeric = Number(normalized);
    if (Number.isInteger(numeric)) {
      if (numeric >= 0 && numeric < optionCount) return numeric;
      if (numeric >= 1 && numeric <= optionCount) return numeric - 1;
    }
  }
  const row = record(value);
  if (row) return parseAnswer(row.key ?? row.letra ?? row.answer ?? row.resposta, optionCount);
  return -1;
}

function mapQuestion(value: unknown, fallbackDiscipline: string): ExternalPracticeQuestion | null {
  const row = record(value);
  if (!row) return null;
  const statement = firstString(row, ['enunciado','statement','question','pergunta','texto','descricao']);
  const options = parseOptions(row.alternativas ?? row.options ?? row.alternatives ?? row.respostas);
  const answer = parseAnswer(row.gabarito ?? row.correct_answer ?? row.answer ?? row.resposta_correta ?? row.resposta, options.length);
  const externalId = firstString(row, ['id','codigo','external_id','questao_id']);
  if (!statement || options.length < 2 || answer < 0 || !externalId) return null;
  const subject = firstString(row, ['materia','subject','disciplina']) || fallbackDiscipline;
  const topic = firstString(row, ['assunto','topic','tema','subassunto']) || 'Questão externa';
  const explanation = firstString(row, ['comentario','explicacao','explanation','resolucao','justificativa']) || 'Confira o gabarito e a fonte da questão.';
  const basis = firstString(row, ['fundamento','base_legal','legal_basis','referencia']) || 'Quest.API';
  const source = firstString(row, ['url','link','source_url','fonte_url']);
  const board = firstString(row, ['banca','board']);
  const exam = firstString(row, ['prova','exam','cargo','orgao']);
  const year = firstNumber(row, ['ano','year']);
  return {
    id: `quest-api-${externalId}`,
    externalId,
    origin: 'quest-api',
    discipline: fallbackDiscipline,
    subject,
    topic,
    statement,
    options,
    answer,
    explanation,
    basis,
    source,
    board,
    year,
    exam,
  };
}

export async function loadQuestApiQuestions(
  client: SupabaseClient,
  input: { discipline: string; subjectLabel?: string; perPage?: number },
): Promise<ExternalPracticeQuestion[]> {
  const params: Record<string, unknown> = {
    per_page: Math.min(Math.max(input.perPage ?? 20, 1), 50),
    include_gabarito: true,
  };
  if (input.subjectLabel) params.materia = input.subjectLabel;

  const { data, error } = await client.functions.invoke('quest-api', {
    body: { resource: 'questions', params },
  });
  if (error) throw error;
  const root = record(data);
  if (root && typeof root.error === 'string') throw new Error(root.error);
  const rows = findQuestionArray(data)
    .map((entry) => mapQuestion(entry, input.discipline))
    .filter((entry): entry is ExternalPracticeQuestion => Boolean(entry));
  if (!rows.length) throw new Error('A Quest.API respondeu, mas nenhuma questão com alternativas e gabarito pôde ser reconhecida.');
  return rows;
}
