import { describe, expect, it } from 'vitest';
import {
  applyLegacyLocalSnapshot,
  isSyncableKey,
  readLegacyLocalSnapshot,
} from '../modern/src/sync/local-snapshot';

class FakeStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('ponte de snapshot do laboratório React', () => {
  it('usa as mesmas exclusões do sincronizador legado', () => {
    expect(isSyncableKey('trilha-flashcard-state')).toBe(true);
    expect(isSyncableKey('trilha-flashcard-theme')).toBe(false);
    expect(isSyncableKey('trilha-flashcard-cloud-meta')).toBe(false);
    expect(isSyncableKey('outra-chave')).toBe(false);
  });

  it('lê apenas dados sincronizáveis e preserva ordenação determinística', () => {
    const storage = new FakeStorage();
    storage.setItem('trilha-flashcard-state', 'estado');
    storage.setItem('trilha-flashcard-theme', 'dark');
    storage.setItem('trilha-flashcard-custom-decks', 'baralhos');
    storage.setItem('fora-do-app', 'x');

    expect(readLegacyLocalSnapshot(storage)).toEqual({
      version: 1,
      entries: {
        'trilha-flashcard-custom-decks': 'baralhos',
        'trilha-flashcard-state': 'estado',
      },
    });
  });

  it('aplica a nuvem sem apagar tema, metadados ou dados de outros apps', () => {
    const storage = new FakeStorage();
    storage.setItem('trilha-flashcard-state', 'antigo');
    storage.setItem('trilha-flashcard-deck:antigo', 'remover');
    storage.setItem('trilha-flashcard-theme', 'dark');
    storage.setItem('trilha-flashcard-cloud-meta', 'meta');
    storage.setItem('fora-do-app', 'preservar');

    applyLegacyLocalSnapshot({
      version: 1,
      entries: {
        'trilha-flashcard-state': 'novo',
        'trilha-flashcard-custom-decks': 'nuvem',
        'trilha-flashcard-theme': 'ignorar',
      },
    }, storage);

    expect(storage.getItem('trilha-flashcard-state')).toBe('novo');
    expect(storage.getItem('trilha-flashcard-custom-decks')).toBe('nuvem');
    expect(storage.getItem('trilha-flashcard-deck:antigo')).toBeNull();
    expect(storage.getItem('trilha-flashcard-theme')).toBe('dark');
    expect(storage.getItem('trilha-flashcard-cloud-meta')).toBe('meta');
    expect(storage.getItem('fora-do-app')).toBe('preservar');
  });
});
