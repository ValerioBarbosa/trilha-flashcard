import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { DeckRow, SubjectRow, TopicRow } from '../study/domain-repository';
import type { ImportCandidate } from './card-manager-repository';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type ParsedPdfCard = {
  front?: string;
  back?: string;
  discipline?: string;
  topic?: string;
  subtopic?: string;
  legalBasis?: string;
  type?: string;
  priority?: string;
  difficulty?: string;
  tag?: string;
  example?: string;
  complement?: string;
  pitfall?: string;
  mnemonic?: string;
  page?: number;
};

const LABELS = new Map<string, keyof ParsedPdfCard>([
  ['pergunta','front'], ['questao','front'], ['frente','front'], ['enunciado','front'], ['q','front'],
  ['resposta','back'], ['gabarito','back'], ['verso','back'], ['a','back'],
  ['disciplina','discipline'], ['baralho','discipline'], ['assunto','topic'], ['topico','topic'], ['subassunto','subtopic'],
  ['fundamento legal','legalBasis'], ['base legal','legalBasis'], ['tipo','type'], ['tipo do cartao','type'],
  ['prioridade','priority'], ['dificuldade','difficulty'], ['tag','tag'], ['etiqueta','tag'], ['exemplo','example'],
  ['observacao','example'], ['complemento','complement'], ['pegadinha','pitfall'], ['mnemonico','mnemonic'], ['macete','mnemonic'],
]);

function canonical(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^\d+[.)]?\s*/, '').trim().toLowerCase();
}

function parseLabeledText(text: string, page: number): ParsedPdfCard[] {
  const cards: ParsedPdfCard[] = [];
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  let current: ParsedPdfCard = {};
  let pending: ParsedPdfCard = {};
  let active: keyof ParsedPdfCard | '' = '';

  const finish = () => {
    if (current.front?.trim() && current.back?.trim()) cards.push({ ...pending, ...current, front: current.front.trim(), back: current.back.trim(), page });
    current = {}; active = '';
  };

  for (const line of lines) {
    const match = line.match(/^(.{1,50}?)\s*[:\-–—]\s*(.*)$/);
    const field = match ? LABELS.get(canonical(match[1])) : undefined;
    if (field) {
      const value = match![2].trim();
      if (field === 'front') { finish(); current = { ...pending, front: value }; pending = {}; }
      else if (field === 'discipline' && current.front && current.back) { finish(); pending[field] = value; }
      else if (!current.front) { pending[field] = value as never; }
      else { current[field] = value as never; }
      active = field;
    } else if (active && active !== 'page') {
      const target = current.front ? current : pending;
      const previous = target[active];
      target[active] = `${typeof previous === 'string' ? previous : ''}\n${line}`.trim() as never;
    }
  }
  finish();
  return cards;
}

function fallbackCard(text: string, page: number): ParsedPdfCard | null {
  const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length >= 2) return { front: blocks[0], back: blocks.slice(1).join('\n\n'), tag: 'PDF', complement: `Importado da página ${page}.`, page };
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 2) return { front: lines[0], back: lines.slice(1).join('\n'), tag: 'PDF', complement: `Importado da página ${page}.`, page };
  return null;
}

async function pageText(page: any): Promise<string> {
  const content = await page.getTextContent();
  const lines: string[] = [];
  let currentY: number | null = null;
  let line = '';
  for (const item of content.items as any[]) {
    if (!('str' in item)) continue;
    const y = Array.isArray(item.transform) ? Math.round(item.transform[5]) : null;
    if (currentY !== null && y !== null && Math.abs(currentY - y) > 2) { if (line.trim()) lines.push(line.trim()); line = ''; }
    line += `${line ? ' ' : ''}${item.str}`;
    if (y !== null) currentY = y;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.join('\n');
}

function findByName<T extends { id: string; name: string }>(items: T[], value?: string): T | undefined {
  if (!value) return undefined;
  const needle = canonical(value);
  return items.find((item) => canonical(item.name) === needle || canonical(item.name).includes(needle) || needle.includes(canonical(item.name)));
}

export async function parsePdfImport(file: File, lookups: { subjects: SubjectRow[]; topics: TopicRow[]; decks: DeckRow[]; defaultSubjectId: string; defaultDeckId: string }): Promise<ImportCandidate[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjsLib.getDocument({ data: bytes }).promise;
  const raw: ParsedPdfCard[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const text = await pageText(page);
    const labeled = parseLabeledText(text, pageNumber);
    if (labeled.length) raw.push(...labeled);
    else { const fallback = fallbackCard(text, pageNumber); if (fallback) raw.push(fallback); }
  }

  return raw.map((card, index) => {
    const subject = findByName(lookups.subjects, card.discipline) || lookups.subjects.find((item) => item.id === lookups.defaultSubjectId);
    const availableDecks = subject ? lookups.decks.filter((deck) => deck.subject_id === subject.id) : lookups.decks;
    const deck = findByName(availableDecks, card.discipline) || availableDecks.find((item) => item.id === lookups.defaultDeckId) || availableDecks[0];
    const topic = subject ? findByName(lookups.topics.filter((item) => item.subject_id === subject.id), card.topic) : undefined;
    const priority = ['A','B','C'].includes(String(card.priority || '').trim().toUpperCase()) ? String(card.priority).trim().toUpperCase() as 'A'|'B'|'C' : '';
    const difficultyRaw = canonical(String(card.difficulty || ''));
    const difficulty = ['facil','easy'].includes(difficultyRaw) ? 'easy' : ['medio','medium'].includes(difficultyRaw) ? 'medium' : ['dificil','hard'].includes(difficultyRaw) ? 'hard' : '';
    return {
      row: index + 1,
      subjectId: subject?.id || lookups.defaultSubjectId,
      deckId: deck?.id || lookups.defaultDeckId,
      topicId: topic?.id || null,
      front: card.front || '',
      back: card.back || '',
      legalBasis: card.legalBasis || '',
      example: card.example || '',
      complement: card.complement || (card.page ? `Importado da página ${card.page}.` : ''),
      pitfall: card.pitfall || '',
      mnemonic: card.mnemonic || '',
      priority,
      difficulty,
      tags: [card.tag || 'PDF', card.subtopic || ''].filter(Boolean),
      cardType: card.type || '',
      source: `${file.name}${card.page ? ` · pág. ${card.page}` : ''}`,
    };
  });
}
