import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE_CODE, Language } from '../../models';

const LANGUAGE_STORAGE_KEY = 'crypto-wallet-language';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  readonly #translate = inject(TranslateService);

  readonly availableLanguages = AVAILABLE_LANGUAGES;
  readonly #currentLanguage = signal<Language>(this.#getInitialLanguage());

  readonly currentLanguage = this.#currentLanguage.asReadonly();

  constructor() {
    this.#initializeLanguage();
  }

  #initializeLanguage(): void {
    const language = this.#currentLanguage();
    this.#translate.use(language.code);
  }

  #getInitialLanguage(): Language {
    const storedCode = this.#getStoredLanguage();
    if (storedCode) {
      const stored = this.availableLanguages.find((l) => l.code === storedCode);
      if (stored) return stored;
    }

    const browserCode = this.#getBrowserLanguage();
    const browser = this.availableLanguages.find((l) => l.code === browserCode);
    if (browser) return browser;

    return this.availableLanguages[0];
  }

  #getBrowserLanguage(): string {
    if (typeof navigator === 'undefined') {
      return DEFAULT_LANGUAGE_CODE;
    }

    const browserLang = navigator.language.split('-')[0];
    const match = this.availableLanguages.find((l) => l.code === browserLang);

    return match?.code ?? DEFAULT_LANGUAGE_CODE;
  }

  #getStoredLanguage(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  }

  changeLanguage(language: Language): void {
    if (language.code === this.#currentLanguage().code) {
      return;
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language.code);
    }

    this.#translate.use(language.code);
    this.#currentLanguage.set(language);
  }
}
