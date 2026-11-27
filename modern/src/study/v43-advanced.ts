import data from './v43-advanced.json';
import { OFFICIAL_EDITAL_2026 } from '../edital/official-edital-2026';

export const V43_ADVANCED_CARDS = data.entries.map((entry) => {
  const subject = OFFICIAL_EDITAL_2026.find(s => s.id === entry.disciplineId);
  const topic = subject?.topics[entry.number - 1];
  if (!subject || !topic) throw new Error('Invalid V4.3 topic: ' + entry.id);
  return {
    id: 'card-trt4-v43-' + entry.id,
    discipline: subject.id, disciplineName: subject.name, topic: topic.name,
    front: entry.front, back: entry.back, legalBasis: entry.legalBasis,
    trap: entry.trap, priority: topic.priority, difficulty: 'hard',
    type: 'Caso prático', tags: ['TRT4','AJAJ','FCC - estilo autoral','V4.3','caso-pratico'],
    level: 'Camada 6 - Aplicação prática', sourceLayer: 'V4.3 - Flashcards avançados',
  };
});
