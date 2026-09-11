import { describe, expect, it } from 'vitest';
import { applyTheme, nextTheme, persistTheme, readStoredTheme } from '../modern/src/shared/theme';

class FakeStorage {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
}

class FakeRoot {
  attributes = new Map<string, string>();
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
}

describe('readStoredTheme', () => {
  it('retorna system quando não há nada salvo', () => {
    expect(readStoredTheme(new FakeStorage())).toBe('system');
  });

  it('retorna o valor salvo quando é light ou dark', () => {
    const storage = new FakeStorage();
    storage.setItem('trilha-theme', 'dark');
    expect(readStoredTheme(storage)).toBe('dark');
  });

  it('ignora um valor inválido salvo e volta para system', () => {
    const storage = new FakeStorage();
    storage.setItem('trilha-theme', 'roxo');
    expect(readStoredTheme(storage)).toBe('system');
  });
});

describe('nextTheme', () => {
  it('circula system -> light -> dark -> system', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });
});

describe('applyTheme', () => {
  it('remove o atributo quando o tema é system', () => {
    const root = new FakeRoot();
    root.setAttribute('data-theme', 'dark');
    applyTheme('system', root);
    expect(root.attributes.has('data-theme')).toBe(false);
  });

  it('define o atributo data-theme para light e dark', () => {
    const root = new FakeRoot();
    applyTheme('dark', root);
    expect(root.attributes.get('data-theme')).toBe('dark');
    applyTheme('light', root);
    expect(root.attributes.get('data-theme')).toBe('light');
  });
});

describe('persistTheme', () => {
  it('remove a chave quando o tema é system', () => {
    const storage = new FakeStorage();
    storage.setItem('trilha-theme', 'dark');
    persistTheme('system', storage);
    expect(storage.getItem('trilha-theme')).toBeNull();
  });

  it('salva light e dark', () => {
    const storage = new FakeStorage();
    persistTheme('dark', storage);
    expect(storage.getItem('trilha-theme')).toBe('dark');
  });
});
