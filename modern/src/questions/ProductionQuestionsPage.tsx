import type { User } from '@supabase/supabase-js';
import { QuestionBankPreview } from './QuestionBankPreview';

export function ProductionQuestionsPage({ user, profileId, defaultBoard, subjects }: { user: User; profileId: string; defaultBoard?: string | null; subjects?: string[] }) {
  return <QuestionBankPreview user={user} profileId={profileId} defaultBoard={defaultBoard} subjects={subjects} embedded />;
}
