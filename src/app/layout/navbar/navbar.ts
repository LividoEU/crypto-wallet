import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ThemeService } from '../../services/theme';
import { LanguageService } from '../../services/language';
import { Language } from '../../models';

@Component({
  selector: 'app-navbar',
  imports: [
    FormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatMenuModule,
    TranslateModule,
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar {
  #themeService = inject(ThemeService);
  #languageService = inject(LanguageService);
  #translate = inject(TranslateService);

  menuToggled = output<void>();
  searchQuery = signal('');
  searchSubmitted = output<string>();

  isDarkMode = this.#themeService.isDarkMode;
  currentLanguage = this.#languageService.currentLanguage;
  availableLanguages = this.#languageService.availableLanguages;

  themeToggleAriaLabel = computed(() =>
    this.isDarkMode()
      ? this.#translate.instant('navbar.switchToLight')
      : this.#translate.instant('navbar.switchToDark')
  );

  themeToggleTooltip = computed(() =>
    this.isDarkMode()
      ? this.#translate.instant('navbar.lightMode')
      : this.#translate.instant('navbar.darkMode')
  );

  onMenuClick(): void {
    this.menuToggled.emit();
  }

  onSearch(): void {
    const query = this.searchQuery().trim();
    if (query) {
      this.searchSubmitted.emit(query);
    }
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  toggleTheme(): void {
    this.#themeService.toggleTheme();
  }

  changeLanguage(language: Language): void {
    this.#languageService.changeLanguage(language);
  }
}
