import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { TranslateModule } from '@ngx-translate/core';
import { WalletService } from '../../services/wallet/wallet';

@Component({
  selector: 'app-sidebar-content',
  imports: [MatIconModule, MatListModule, TranslateModule],
  templateUrl: './sidebar-content.html',
  styleUrl: './sidebar-content.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarContent {
  #walletService = inject(WalletService);

  createBtcWallet(): void {
    this.#walletService.createWallet('bitcoin', 'mainnet');
  }

  createTestWallet(): void {
    this.#walletService.createWallet('bitcoin', 'testnet');
  }
}
