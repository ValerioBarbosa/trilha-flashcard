import type { SupabaseClient } from '@supabase/supabase-js';
import { OFFICIAL_EDITAL_2026, OFFICIAL_TOPIC_COUNT } from '../edital/official-edital-2026';
import type { DeckRow, SubjectRow, TopicRow } from './domain-repository';
import { isStudyContent } from '../../../src/features/study/card-purpose';

export type AuditCard = {
  id: string;
  deck_id: string;
  subject_id: string | null;
  topic_id: string | null;
  legacy_id: string | null;
  front: string;
  back: string;
  card_type: string | null;
  legal_basis: string | null;
  source: string | null;
  tags: string[] | null;
};

export type SafeTopicMapping = {
  fromId: string;
  toId: string;
  subjectId: string;
  fromName: string;
  toName: string;
  match: 'exato' | 'título contido' | 'termos equivalentes';
  cardIds: string[];
};

export type CatalogAudit = {
  checkedAt: string;
  subjects: number;
  expectedTopics: number;
  registeredTopics: number;
  coveredTopics: number;
  potentialCoveredAfterMapping: number;
  totalActiveCards: number;
  studyCards: number;
  lawCards: number;
  v4Cards: number;
  legacyStudyCards: number;
  withoutTopic: number;
  outsideOfficialMatrix: number;
  unknownTopic: number;
  missingLegalBasis: number;
  potentialDuplicates: number;
  contentKeyCollisions: number;
  safeMappings: SafeTopicMapping[];
  missingTopics: Array<{ subject: string; name: string }>;
  requiresHumanReview: number;
};

const PAGE_SIZE = 500;

export async function listAuditCards(client: SupabaseClient, profileId: string): Promise<AuditCard[]> {
  const all: AuditCard[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client.from('cards')
      .select('id,deck_id,subject_id,topic_id,legacy_id,front,back,card_type,legal_basis,source,tags')
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .eq('suspended', false)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as AuditCard[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function fingerprint(card: AuditCard): string {
  // A constraint do banco utiliza lower(trim(front || '|' || back)).
  return card.front.trim().toLowerCase() + '|' + card.back.trim().toLowerCase();
}
function relaxedKey(card: AuditCard): string {
  return normalize(card.front) + '|' + normalize(card.back);
}
const STOP = new Set(['da','de','do','das','dos','e','em','a','o','as','os','um','uma','ou','com','por','para','no','na','nos','nas','ao','aos','sobre','se','que','suas','seus']);
function tokens(value: string): Set<string> {
  return new Set(normalize(value).split(' ').filter((word) => word.length > 2 && !STOP.has(word)));
}

function officialSubjectId(subject: SubjectRow): string | null {
  const n = normalize(subject.name);
  const known: Record<string, string> = {
    'portugues':'portuguese', 'lingua portuguesa':'portuguese',
    'matematica rlm':'math-logic', 'matematica e raciocinio logico':'math-logic',
    'regimento legislacao trt':'trt-legislation', 'nocoes de legislacao':'trt-legislation',
    'nocoes de direitos humanos':'human-rights', 'direitos humanos':'human-rights',
    'nocoes de informatica':'informatics', 'informatica':'informatics',
    'direito constitucional':'constitutional', 'direito administrativo':'administrative',
    'direito do trabalho':'labor-law', 'direito processual do trabalho':'labor-procedure',
    'direito civil':'civil-law', 'direito processual civil':'civil-procedure',
  };
  return known[n] || null;
}

function uniqueMatch(from: TopicRow, official: TopicRow[]): { toId: string; match: SafeTopicMapping['match'] } | null {
  const raw = normalize(from.name);
  if (!raw || raw.length < 8) return null;
  const exact = official.filter((topic) => normalize(topic.name) === raw && topic.id !== from.id);
  if (exact.length === 1) return { toId: exact[0].id, match: 'exato' };
  if (exact.length > 1) return null;
  const words = tokens(from.name);
  if (raw.length < 20 || words.size < 3) return null;
  const contained = official.filter((topic) => {
    const normalized = normalize(topic.name);
    const otherWords = tokens(topic.name);
    return topic.id !== from.id && otherWords.size >= 3 && (
      normalized.includes(raw) || (normalized.length >= 20 && raw.includes(normalized))
    );
  });
  if (contained.length === 1) return { toId: contained[0].id, match: 'título contido' };
  if (contained.length > 1) return null;
  const scored = official.map((topic) => {
    const other = tokens(topic.name);
    const intersection = [...words].filter((word) => other.has(word)).length;
    return { id: topic.id, score: intersection / Math.max(words.size, other.size), intersection };
  }).filter((item) => item.intersection >= 4).sort((a,b) => b.score - a.score);
  if (scored[0] && scored[0].score >= .85 && (!scored[1] || scored[0].score - scored[1].score >= .2)) {
    return { toId: scored[0].id, match: 'termos equivalentes' };
  }
  return null;
}

export function buildCatalogAudit(
  subjects: SubjectRow[],
  topics: TopicRow[],
  decks: DeckRow[],
  cards: AuditCard[],
): CatalogAudit {
  const subjectsById = new Map(subjects.map((item) => [item.id, item]));
  const canonicalBySubjectId = new Map(subjects.map((subject) => [subject.id, officialSubjectId(subject)]));
  const official = new Map(OFFICIAL_EDITAL_2026.map((subject) => [
    subject.id, new Set(subject.topics.map((topic) => normalize(topic.name))),
  ]));
  const matrixBySubject = new Map<string, TopicRow[]>();
  const registered = new Set<string>();
  for (const topic of topics) {
    if (topic.parent_id) continue;
    const discipline = canonicalBySubjectId.get(topic.subject_id);
    if (!discipline || !official.get(discipline)?.has(normalize(topic.name))) continue;
    const key = discipline + '|' + normalize(topic.name);
    registered.add(key);
    matrixBySubject.set(topic.subject_id, [...(matrixBySubject.get(topic.subject_id) || []), topic]);
  }
  const officialIds = new Set([...matrixBySubject.values()].flat().map((topic) => topic.id));
  const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
  const decksById = new Map(decks.map((deck) => [deck.id, deck]));
  const allStudyCards = cards.filter(isStudyContent);
  const covered = new Set(allStudyCards.map((card) => card.topic_id).filter((id): id is string => Boolean(id) && officialIds.has(id)));
  const distinctByFingerprint = new Set<string>();
  const distinctRelaxed = new Set<string>();
  let possibleDuplicates = 0, collisions = 0;
  for (const card of cards) {
    const fp = fingerprint(card);
    const relaxed = relaxedKey(card);
    if (distinctByFingerprint.has(fp)) collisions++;
    if (distinctRelaxed.has(relaxed)) possibleDuplicates++;
    distinctByFingerprint.add(fp);
    distinctRelaxed.add(relaxed);
  }

  const candidates: SafeTopicMapping[] = [];
  const legacyByTopic = new Map<string, AuditCard[]>();
  for (const card of allStudyCards) {
    if (!card.topic_id || officialIds.has(card.topic_id)) continue;
    const deck = decksById.get(card.deck_id);
    if (!deck?.is_builtin || !card.legacy_id?.startsWith('card-trt4-')) continue;
    if (card.subject_id !== deck.subject_id) continue;
    legacyByTopic.set(card.topic_id, [...(legacyByTopic.get(card.topic_id) || []), card]);
  }

  for (const [fromId, linked] of legacyByTopic) {
    const old = topicsById.get(fromId);
    if (!old || old.parent_id || !subjectsById.has(old.subject_id)) continue;
    const officialTopics = matrixBySubject.get(old.subject_id) || [];
    const match = uniqueMatch(old, officialTopics);
    if (!match) continue;
    const target = topicsById.get(match.toId);
    if (!target) continue;
    candidates.push({
      fromId, toId:match.toId, subjectId:old.subject_id,
      fromName:old.name, toName:target.name, match:match.match,
      cardIds:linked.map((card) => card.id),
    });
  }
  const pendingTargets = new Set(candidates.map((candidate) => candidate.toId));
  const missingTopics = OFFICIAL_EDITAL_2026.flatMap((subject) => subject.topics
    .filter((topic) => !registered.has(subject.id + '|' + normalize(topic.name)))
    .map((topic) => ({subject:subject.name,name:topic.name})));
  return {
    checkedAt:new Date().toISOString(),
    subjects: OFFICIAL_EDITAL_2026.length,
    expectedTopics: OFFICIAL_TOPIC_COUNT,
    registeredTopics: registered.size,
    coveredTopics: covered.size,
    potentialCoveredAfterMapping: new Set([...covered, ...pendingTargets]).size,
    totalActiveCards: cards.length,
    studyCards: allStudyCards.length,
    lawCards: cards.length - allStudyCards.length,
    v4Cards:cards.filter((card) => card.legacy_id?.startsWith('card-trt4-v4-')).length,
    legacyStudyCards:allStudyCards.filter((card) => card.legacy_id?.startsWith('card-trt4-') && !card.legacy_id.startsWith('card-trt4-v4-')).length,
    withoutTopic:allStudyCards.filter((card) => !card.topic_id).length,
    outsideOfficialMatrix:allStudyCards.filter((card) => card.topic_id && topicsById.has(card.topic_id) && !officialIds.has(card.topic_id)).length,
    unknownTopic:allStudyCards.filter((card) => card.topic_id && !topicsById.has(card.topic_id)).length,
    missingLegalBasis:allStudyCards.filter((card) => !card.legal_basis?.trim()).length,
    potentialDuplicates:possibleDuplicates,
    contentKeyCollisions:collisions,
    safeMappings:candidates,
    missingTopics,
    requiresHumanReview: Math.max(0, allStudyCards.filter((card) => card.topic_id && !officialIds.has(card.topic_id)).length - candidates.reduce((sum, candidate) => sum + candidate.cardIds.length, 0)),
  };
}

export async function applySafeTopicMappings(
  client: SupabaseClient, profileId: string, mappings: SafeTopicMapping[],
): Promise<{ changed: number; groups: number }> {
  let changed = 0, groups = 0;
  for (const mapping of mappings) {
    for (let start = 0; start < mapping.cardIds.length; start += 50) {
      const ids = mapping.cardIds.slice(start, start + 50);
      // Atualização apenas dos IDs auditados, preservando identidade do cartão e revisões.
      const { data, error } = await client.from('cards')
        .update({ topic_id:mapping.toId })
        .eq('profile_id', profileId)
        .eq('topic_id', mapping.fromId)
        .is('deleted_at', null)
        .eq('suspended', false)
        .in('id', ids)
        .select('id');
      if (error) throw error;
      changed += data?.length || 0;
    }
    groups++;
  }
  return { changed, groups };
}
