export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'trilha-theme';
const ORDER: ThemePreference[] = ['system', 'light', 'dark'];

export const THEME_LABEL: Record<ThemePreference, string> = {
  system: 'Automático',
  light: 'Claro',
  dark: 'Escuro',
};

export const THEME_ICON: Record<ThemePreference, string> = {
  system: '🌓',
  light: '☀️',
  dark: '🌙',
};

export function readStoredTheme(storage: Pick<Storage, 'getItem'>): ThemePreference {
  const value = storage.getItem(STORAGE_KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function nextTheme(current: ThemePreference): ThemePreference {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
}

export function applyTheme(theme: ThemePreference, root: Pick<HTMLElement, 'setAttribute' | 'removeAttribute'>): void {
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function persistTheme(theme: ThemePreference, storage: Pick<Storage, 'setItem' | 'removeItem'>): void {
  if (theme === 'system') storage.removeItem(STORAGE_KEY);
  else storage.setItem(STORAGE_KEY, theme);
}
