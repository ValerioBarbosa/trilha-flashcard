import type { SubjectRow, TopicRow } from '../study/domain-repository';

export type EditalSubject = SubjectRow & { rootTopics: TopicRow[] };

export function buildEditalSubjects(subjects: SubjectRow[], topics: TopicRow[], query = ''): EditalSubject[] {
  const normalized = query.trim().toLowerCase();
  return subjects
    .map((subject) => ({
      ...subject,
      rootTopics: topics.filter((topic) => topic.subject_id === subject.id && !topic.parent_id),
    }))
    .filter((subject) => {
      if (!normalized) return true;
      return subject.name.toLowerCase().includes(normalized)
        || topics.some((topic) => topic.subject_id === subject.id && `${topic.name} ${topic.edital_text ?? ''} ${topic.legal_basis ?? ''}`.toLowerCase().includes(normalized));
    });
}
