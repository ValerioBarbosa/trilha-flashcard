import type { CardRow, DeckRow, ProfileRow, SubjectRow, TopicRow } from './domain-repository';

type WorkspaceSnapshot = {
  profile: ProfileRow;
  profiles: ProfileRow[];
  subjects: SubjectRow[];
  topics: TopicRow[];
  decks: DeckRow[];
  savedAt: string;
};

const PREFIX = 'trilha-offline-v1';

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache offline é auxiliar; falha de quota não deve derrubar o estudo.
  }
}

export function saveWorkspaceOffline(userId: string, snapshot: Omit<WorkspaceSnapshot, 'savedAt'>): void {
  write(`${PREFIX}:workspace:${userId}`, { ...snapshot, savedAt: new Date().toISOString() });
}

export function readWorkspaceOffline(userId: string): WorkspaceSnapshot | null {
  return read<WorkspaceSnapshot>(`${PREFIX}:workspace:${userId}`);
}

export function saveDeckCardsOffline(profileId: string, deckId: string, cards: CardRow[]): void {
  write(`${PREFIX}:cards:${profileId}:${deckId}`, { cards, savedAt: new Date().toISOString() });
}

export function readDeckCardsOffline(profileId: string, deckId: string): CardRow[] | null {
  return read<{ cards: CardRow[]; savedAt: string }>(`${PREFIX}:cards:${profileId}:${deckId}`)?.cards ?? null;
}

export function offlineWorkspaceAge(userId: string): string | null {
  const snapshot = readWorkspaceOffline(userId);
  return snapshot?.savedAt ?? null;
}
