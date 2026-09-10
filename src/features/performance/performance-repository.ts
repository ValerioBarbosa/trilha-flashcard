import type { SupabaseClient, User } from '@supabase/supabase-js';

export type PerformanceSummary = {
  totalReviews: number;
  correctReviews: number;
  accuracy: number;
  reviewedToday: number;
  openErrors: number;
};

export async function loadPerformance(client: SupabaseClient, user: User, profileId: string): Promise<PerformanceSummary> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [{ data: reviews, error: reviewError }, { count: openErrors, error: errorCountError }] = await Promise.all([
    client.from('reviews').select('rating,reviewed_at').eq('user_id', user.id).eq('profile_id', profileId),
    client.from('error_notebook').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('profile_id', profileId).eq('resolved', false),
  ]);
  if (reviewError) throw reviewError;
  if (errorCountError) throw errorCountError;
  const reviewRows = reviews ?? [];
  const correctReviews = reviewRows.filter((row: any) => Number(row.rating) >= 3).length;
  const reviewedToday = reviewRows.filter((row: any) => new Date(row.reviewed_at) >= today).length;
  return {
    totalReviews: reviewRows.length,
    correctReviews,
    accuracy: reviewRows.length ? Math.round((correctReviews / reviewRows.length) * 100) : 0,
    reviewedToday,
    openErrors: openErrors ?? 0,
  };
}
