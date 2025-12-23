import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
} from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeService } from '../../services/theme';
import { LanguageService } from '../../services/language';
import { WalletSessionService } from '../../services/wallet-session';
import { Language } from '../../models';

@Component({
  selector: 'app-navbar',
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
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
  #walletSession = inject(WalletSessionService);

  menuToggled = output<void>();

  isDarkMode = this.#themeService.isDarkMode;
  currentLanguage = this.#languageService.currentLanguage;
  availableLanguages = this.#languageService.availableLanguages;
  isLoggedIn = this.#walletSession.isLoggedIn;

  onMenuClick(): void {
    this.menuToggled.emit();
  }

  toggleTheme(): void {
    this.#themeService.toggleTheme();
  }

  changeLanguage(language: Language): void {
    this.#languageService.changeLanguage(language);
  }

  logout(): void {
    this.#walletSession.logout();
  }
}
