import type { SupabaseClient, User } from '@supabase/supabase-js';
import { listLatestReviewsByCard } from '../study/domain-repository';

export type SubjectPerformance = {
  subjectId: string;
  reviews: number;
  correct: number;
  accuracy: number;
};

export type PerformanceSummary = {
  totalReviews: number;
  correctReviews: number;
  accuracy: number;
  reviewedToday: number;
  openErrors: number;
  streakDays: number;
  dueNow: number;
  bySubject: SubjectPerformance[];
};

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeStreak(activeDays: Set<string>, referenceDate: Date): number {
  const cursor = new Date(referenceDate);
  cursor.setHours(12, 0, 0, 0);
  if (!activeDays.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!activeDays.has(dateKey(cursor))) return 0;
  }
  let streak = 0;
  while (activeDays.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function loadPerformance(client: SupabaseClient, user: User, profileId: string): Promise<PerformanceSummary> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = Date.now();

  const [{ data: reviews, error: reviewError }, { count: openErrors, error: errorCountError }, latestByCard] = await Promise.all([
    client.from('reviews').select('rating,reviewed_at,cards(subject_id)').eq('user_id', user.id).eq('profile_id', profileId),
    client.from('error_notebook').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('profile_id', profileId).eq('resolved', false),
    listLatestReviewsByCard(client, profileId),
  ]);
  if (reviewError) throw reviewError;
  if (errorCountError) throw errorCountError;

  const reviewRows = (reviews ?? []) as Array<{ rating: number; reviewed_at: string; cards: { subject_id: string | null }[] | { subject_id: string | null } | null }>;
  const subjectIdOf = (row: (typeof reviewRows)[number]) => Array.isArray(row.cards) ? row.cards[0]?.subject_id ?? null : row.cards?.subject_id ?? null;
  const correctReviews = reviewRows.filter((row) => Number(row.rating) >= 3).length;
  const reviewedToday = reviewRows.filter((row) => new Date(row.reviewed_at) >= today).length;

  const activeDays = new Set(reviewRows.map((row) => dateKey(new Date(row.reviewed_at))));
  const streakDays = computeStreak(activeDays, new Date());

  const dueNow = Array.from(latestByCard.values()).filter((row) => new Date(row.due_at).getTime() <= now).length;

  const bySubjectMap = new Map<string, { reviews: number; correct: number }>();
  for (const row of reviewRows) {
    const subjectId = subjectIdOf(row);
    if (!subjectId) continue;
    const bucket = bySubjectMap.get(subjectId) ?? { reviews: 0, correct: 0 };
    bucket.reviews += 1;
    if (Number(row.rating) >= 3) bucket.correct += 1;
    bySubjectMap.set(subjectId, bucket);
  }
  const bySubject: SubjectPerformance[] = Array.from(bySubjectMap.entries()).map(([subjectId, bucket]) => ({
    subjectId,
    reviews: bucket.reviews,
    correct: bucket.correct,
    accuracy: bucket.reviews ? Math.round((bucket.correct / bucket.reviews) * 100) : 0,
  }));

  return {
    totalReviews: reviewRows.length,
    correctReviews,
    accuracy: reviewRows.length ? Math.round((correctReviews / reviewRows.length) * 100) : 0,
    reviewedToday,
    openErrors: openErrors ?? 0,
    streakDays,
    dueNow,
    bySubject,
  };
}
