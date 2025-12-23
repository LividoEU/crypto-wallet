import { ChangeDetectionStrategy, Component, inject, isDevMode } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { TranslateModule } from '@ngx-translate/core';
import { WalletService } from '../../services/wallet/wallet';
import { WalletSessionService } from '../../services/wallet-session';
import {
  WalletCreationDialog,
  WalletCreationDialogResult,
} from '../../shared/components/wallet-creation-dialog';

@Component({
  selector: 'app-sidebar-content',
  imports: [MatIconModule, MatListModule, TranslateModule],
  templateUrl: './sidebar-content.html',
  styleUrl: './sidebar-content.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarContent {
  #walletService = inject(WalletService);
  #walletSession = inject(WalletSessionService);
  #dialog = inject(MatDialog);

  isDevMode = isDevMode();

  createBtcWallet(): void {
    const dialogRef = this.#dialog.open(WalletCreationDialog, {
      width: '520px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: WalletCreationDialogResult | undefined) => {
      if (result?.action === 'login' && result.mnemonic) {
        // Close existing session if any
        if (this.#walletSession.isLoggedIn()) {
          this.#walletSession.logout();
        }
        // Login with the new wallet
        this.#walletSession.login(result.mnemonic);
      }
    });
  }

  createTestWallet(): void {
    this.#walletService.createWallet('bitcoin', 'testnet');
  }
}
