import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { TranslateModule } from '@ngx-translate/core';
import {
  MnemonicDialog,
  MnemonicDialogResult,
} from '../../shared/components/mnemonic-dialog';
import { WalletSessionService } from '../../services/wallet-session';
import { WalletTransaction } from '../../interfaces';

@Component({
  selector: 'app-dashboard',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    TranslateModule,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  #dialog = inject(MatDialog);
  #router = inject(Router);
  #walletSession = inject(WalletSessionService);

  isLoggedIn = this.#walletSession.isLoggedIn;
  isScanning = this.#walletSession.isScanning;
  balanceSatoshis = this.#walletSession.balanceSatoshis;
  eurPrice = this.#walletSession.eurPrice;
  transactions = this.#walletSession.transactions;
  usedAddresses = this.#walletSession.usedAddresses;

  balanceBtc = computed(() => this.#walletSession.satoshisToBtc(this.balanceSatoshis()));
  balanceEur = computed(() => this.#walletSession.satoshisToEur(this.balanceSatoshis()));

  ngOnInit(): void {
    this.openMnemonicDialog();
  }

  openMnemonicDialog(): void {
    const dialogRef = this.#dialog.open(MnemonicDialog, {
      width: '480px',
      disableClose: true,
      autoFocus: true,
    });

    dialogRef.afterClosed().subscribe((result: MnemonicDialogResult | undefined) => {
      if (result?.action === 'continue' && result.mnemonic) {
        this.#walletSession.login(result.mnemonic);
      }
    });
  }

  satoshisToBtc(satoshis: number): number {
    return this.#walletSession.satoshisToBtc(satoshis);
  }

  formatDate(timestamp: number): Date {
    return new Date(timestamp * 1000);
  }

  isOwnAddress(address: string | undefined): boolean {
    if (!address) return false;
    return this.usedAddresses().some((a) => a.address === address);
  }

  navigateToAddress(address: string): void {
    console.log('Address data:', {
      address,
      isOwn: this.isOwnAddress(address),
      addressInfo: this.usedAddresses().find((a) => a.address === address),
    });
  }

  getTransactionType(tx: WalletTransaction): 'sent' | 'received' {
    return tx.result < 0 ? 'sent' : 'received';
  }
}
