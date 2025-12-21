export interface Language {
  readonly code: string;
  readonly label: string;
  readonly icon: string;
}

export const AVAILABLE_LANGUAGES: readonly Language[] = [
  {
    code: 'en',
    label: 'English',
    icon: '🇺🇸',
  },
  {
    code: 'es',
    label: 'Español',
    icon: '🇪🇸',
  },
] as const;

export const DEFAULT_LANGUAGE_CODE = 'en';
