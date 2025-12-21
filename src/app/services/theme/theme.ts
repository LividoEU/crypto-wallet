import { effect, Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'crypto-wallet-theme';

/**
 * Service for managing the application's theme (light/dark mode).
 * Persists the user's preference to localStorage and applies it to the document.
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly #themeMode = signal<ThemeMode>(this.#getInitialTheme());

  /**
   * The current theme mode as a readonly signal.
   */
  readonly themeMode = this.#themeMode.asReadonly();

  /**
   * Whether dark mode is currently active.
   */
  readonly isDarkMode = () => this.#themeMode() === 'dark';

  constructor() {
    effect(() => {
      this.#applyTheme(this.#themeMode());
    });
  }

  /**
   * Toggle between light and dark themes.
   */
  toggleTheme(): void {
    this.#themeMode.update((current) => (current === 'light' ? 'dark' : 'light'));
  }

  /**
   * Set a specific theme mode.
   */
  setTheme(mode: ThemeMode): void {
    this.#themeMode.set(mode);
  }

  /**
   * Get the initial theme from localStorage or default to dark.
   */
  #getInitialTheme(): ThemeMode {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    }

    return 'dark';
  }

  /**
   * Apply the theme to the document and persist to localStorage.
   */
  #applyTheme(mode: ThemeMode): void {
    if (typeof document !== 'undefined') {
      document.body.style.colorScheme = mode;
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    }
  }
}
