import type { User } from '@supabase/supabase-js';
import { QuestionBankPreview } from './QuestionBankPreview';

export function ProductionQuestionsPage({ user, profileId }: { user: User; profileId: string }) {
  return <QuestionBankPreview user={user} profileId={profileId} embedded />;
}
