import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase-client';
import { createStudyProfile, ensureDefaultProfile, type NewProfileInput } from './study-repository';
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

function activeProfileKey(userId: string): string {
  return `trilha-active-profile:${userId}`;
}

function readStoredProfileId(userId: string): string | null {
  try { return window.localStorage.getItem(activeProfileKey(userId)); } catch { return null; }
}

function storeProfileId(userId: string, profileId: string): void {
  try { window.localStorage.setItem(activeProfileKey(userId), profileId); } catch { /* localStorage indisponível */ }
}

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
  switchProfile: (profileId: string) => void;
  createProfile: (input: NewProfileInput) => Promise<ProfileRow>;
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
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => readStoredProfileId(user.id));

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = getSupabaseClient();
      const defaultProfile = await ensureDefaultProfile(client, user) as ProfileRow;
      const nextProfiles = await listProfiles(client, user);
      const resolvedProfile = (activeProfileId && nextProfiles.find((item) => item.id === activeProfileId)) || defaultProfile;

      const { count, error: countError } = await client.from('decks')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', resolvedProfile.id)
        .eq('is_builtin', true);
      if (countError) throw countError;

      if (resolvedProfile.is_builtin && (count ?? 0) === 0) {
        setSeeding(true);
        await seedBuiltinStudyCatalog(client, user, resolvedProfile.id);
        setSeeding(false);
      }

      const [nextSubjects, nextTopics, nextDecks] = await Promise.all([
        listSubjects(client, resolvedProfile.id),
        listTopics(client, resolvedProfile.id),
        listDecks(client, resolvedProfile.id),
      ]);
      setProfile(resolvedProfile);
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
  }, [user.id, activeProfileId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchProfile = useCallback((profileId: string) => {
    storeProfileId(user.id, profileId);
    setActiveProfileId(profileId);
  }, [user.id]);

  const createProfile = useCallback(async (input: NewProfileInput) => {
    const client = getSupabaseClient();
    const created = await createStudyProfile(client, user, input) as ProfileRow;
    switchProfile(created.id);
    return created;
  }, [user, switchProfile]);

  return { profile, profiles, subjects, topics, decks, loading, seeding, error, refresh, switchProfile, createProfile };
}
