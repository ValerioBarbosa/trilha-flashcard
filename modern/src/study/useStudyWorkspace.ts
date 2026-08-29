import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase-client';
import { ensureDefaultProfile } from './study-repository';
import { seedBuiltinStudyCatalog } from './builtin-seed';
import {
  listDecks,
  listProfiles,
  listSubjects,
  listTopics,
  type DeckRow,
  type ProfileRow,
  type SubjectRow,
  type TopicRow,
} from './domain-repository';

export type StudyWorkspace = {
  profile: ProfileRow | null;
  profiles: ProfileRow[];
  subjects: SubjectRow[];
  topics: TopicRow[];
  decks: DeckRow[];
  loading: boolean;
  seeding: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useStudyWorkspace(user: User): StudyWorkspace {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [decks, setDecks] = useState<DeckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = getSupabaseClient();
      const defaultProfile = await ensureDefaultProfile(client, user) as ProfileRow;

      const { count, error: countError } = await client.from('decks')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', defaultProfile.id)
        .eq('is_builtin', true);
      if (countError) throw countError;

      if ((count ?? 0) === 0) {
        setSeeding(true);
        await seedBuiltinStudyCatalog(client, user, defaultProfile.id);
        setSeeding(false);
      }

      const [nextProfiles, nextSubjects, nextTopics, nextDecks] = await Promise.all([
        listProfiles(client, user),
        listSubjects(client, defaultProfile.id),
        listTopics(client, defaultProfile.id),
        listDecks(client, defaultProfile.id),
      ]);
      setProfile(defaultProfile);
      setProfiles(nextProfiles);
      setSubjects(nextSubjects);
      setTopics(nextTopics);
      setDecks(nextDecks);
    } catch (cause) {
      setSeeding(false);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { profile, profiles, subjects, topics, decks, loading, seeding, error, refresh };
}
