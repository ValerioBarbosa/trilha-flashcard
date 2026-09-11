import { useEffect, useState } from 'react';
import { applyTheme, nextTheme, persistTheme, readStoredTheme, THEME_ICON, THEME_LABEL } from './theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => readStoredTheme(window.localStorage));

  useEffect(() => {
    applyTheme(theme, document.documentElement);
  }, [theme]);

  function handleClick() {
    const next = nextTheme(theme);
    setTheme(next);
    persistTheme(next, window.localStorage);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={handleClick}
      title={`Tema: ${THEME_LABEL[theme]}`}
      aria-label={`Alternar tema (atual: ${THEME_LABEL[theme]})`}
    >
      <span aria-hidden="true">{THEME_ICON[theme]}</span>
      {THEME_LABEL[theme]}
    </button>
  );
}
