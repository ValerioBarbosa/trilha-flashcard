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

const BUILTIN_CATALOG_VERSION = 'trt4-ajaj-v3-1437-global-reconcile-v2-2026-09-23';

function activeProfileKey(userId: string): string {
  return `trilha-active-profile:${userId}`;
}

function builtinCatalogVersionKey(userId: string, profileId: string): string {
  return `trilha-builtin-catalog-version:${userId}:${profileId}`;
}

function readBuiltinCatalogVersion(userId: string, profileId: string): string | null {
  try { return window.localStorage.getItem(builtinCatalogVersionKey(userId, profileId)); } catch { return null; }
}

function storeBuiltinCatalogVersion(userId: string, profileId: string): void {
  try { window.localStorage.setItem(builtinCatalogVersionKey(userId, profileId), BUILTIN_CATALOG_VERSION); } catch { /* localStorage indisponível */ }
}

function readStoredProfileId(userId: string): string | null {
  try { return window.localStorage.getItem(activeProfileKey(userId)); } catch { return null; }
}

function storeProfileId(userId: string, profileId: string): void {
  try { window.localStorage.setItem(activeProfileKey(userId), profileId); } catch { /* localStorage indisponível */ }
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object') {
    const value = cause as Record<string, unknown>;
    const message = typeof value.message === 'string' ? value.message : null;
    const details = typeof value.details === 'string' ? value.details : null;
    const hint = typeof value.hint === 'string' ? value.hint : null;
    const code = typeof value.code === 'string' ? value.code : null;
    return [message, details, hint, code ? `Código: ${code}` : null].filter(Boolean).join(' · ') || 'Erro inesperado ao carregar os estudos.';
  }
  return String(cause);
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

      const catalogOutdated = readBuiltinCatalogVersion(user.id, resolvedProfile.id) !== BUILTIN_CATALOG_VERSION;
      if (resolvedProfile.is_builtin && ((count ?? 0) === 0 || catalogOutdated)) {
        setSeeding(true);
        try {
          await seedBuiltinStudyCatalog(client, user, resolvedProfile.id);
          storeBuiltinCatalogVersion(user.id, resolvedProfile.id);
        } catch (seedError) {
          if ((count ?? 0) === 0) throw seedError;
          console.warn('Falha não bloqueante ao atualizar catálogo nativo:', errorMessage(seedError));
        } finally {
          setSeeding(false);
        }
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
      setError(errorMessage(cause));
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
