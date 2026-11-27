import humanIt from './v4-supplement-human-it.json';
import civil from './v4-supplement-civil.json';
import core from './v4-supplement-core.json';
import { OFFICIAL_EDITAL_2026 } from '../edital/official-edital-2026';

export type V4NewCard = {
  id: string; discipline: string; disciplineName: string; topic: string; legalBasis: string;
  front: string; back: string; priority: 'A'|'B'|'C'; difficulty: 'medium';
  type: string; tags: string[]; level: string; sourceLayer: string;
};

type Entry = { disciplineId: string; number: number; front: string; back: string; legalBasis: string };
const entries = [...humanIt.entries, ...civil.entries, ...core.entries] as Entry[];

function compile() {
  const seen = new Set<string>();
  return entries.map((entry): V4NewCard => {
    const subject = OFFICIAL_EDITAL_2026.find((item) => item.id === entry.disciplineId);
    const topic = subject?.topics[entry.number - 1];
    if (!subject || !topic) throw new Error(`Unmapped V4 flashcard: ${entry.disciplineId} #${entry.number}`);
    if (!entry.front.trim() || !entry.back.trim()) throw new Error('Empty V4 flashcard');
    const id = `card-trt4-v4-${entry.disciplineId}-${String(entry.number).padStart(2,'0')}`;
    if (seen.has(id)) throw new Error(`Duplicate V4 flashcard: ${id}`);
    seen.add(id);
    return {
      id, discipline:entry.disciplineId, disciplineName:subject.name,
      topic:topic.name, front:entry.front, back:entry.back,
      legalBasis:entry.legalBasis, priority:topic.priority, difficulty:'medium',
      type:'Recuperação ativa V4',
      tags:['TRT4','AJAJ','Edital 01/2026','Matriz V4','Conteúdo verificado',`recorte-${entry.number}`],
      level:'Camada 5 - Atualização do edital oficial',
      sourceLayer:'V4 - Aprofundamento das disciplinas incorporadas',
    };
  });
}

export const V4_NEW_CONTENT_CARDS: V4NewCard[] = compile();
export const V4_NEW_CONTENT_COUNT = V4_NEW_CONTENT_CARDS.length;
export const V4_NEW_CARD_IDS = new Set(V4_NEW_CONTENT_CARDS.map((card) => card.id));
