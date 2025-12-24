import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { MnemonicDialog, MnemonicDialogResult } from '../../shared/components/mnemonic-dialog';
import { SendDialog } from '../../shared/components/send-dialog';
import { WalletSessionService } from '../../services/wallet-session';
import { WalletTransactionService } from '../../services/wallet-transaction';
import { DerivedAddress, WalletTransaction } from '../../interfaces';

@Component({
  selector: 'app-dashboard',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatMenuModule,
    MatTooltipModule,
    MatSnackBarModule,
    TranslateModule,
    QRCodeComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  readonly #dialog = inject(MatDialog);
  readonly #router = inject(Router);
  readonly #walletSession = inject(WalletSessionService);
  readonly #clipboard = inject(Clipboard);
  readonly #snackBar = inject(MatSnackBar);
  readonly #translate = inject(TranslateService);

  isLoggedIn = this.#walletSession.isLoggedIn;
  isScanning = this.#walletSession.isScanning;
  balanceSatoshis = this.#walletSession.balanceSatoshis;
  eurPrice = this.#walletSession.eurPrice;
  transactions = this.#walletSession.transactions;
  usedAddresses = this.#walletSession.usedAddresses;

  // balanceBtc = computed(() => this.#walletSession.satoshisToBtc(this.balanceSatoshis()));
  // balanceEur = computed(() => this.#walletSession.satoshisToEur(this.balanceSatoshis()));
  // Calculate confirmed balance by excluding pending transactions
  confirmedBalanceSatoshis = computed(() => {
    const total = this.balanceSatoshis();
    const pendingAmount = this.transactions()
      .filter((tx) => !tx.blockHeight)
      .reduce((sum, tx) => sum + tx.result, 0);
    return total - pendingAmount;
  });

  balanceBtc = computed(() => this.#walletSession.satoshisToBtc(this.confirmedBalanceSatoshis()));
  balanceEur = computed(() => this.#walletSession.satoshisToEur(this.confirmedBalanceSatoshis()));

  receiveAddress = signal<DerivedAddress | null>(null);
  qrCodeData = computed(() => {
    const address = this.receiveAddress();
    if (!address) return '';
    return address.address;
  });

  ngOnInit(): void {
    if (!this.isLoggedIn()) {
      this.openMnemonicDialog();
    }
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
    this.#router.navigate(['/address', address]);
  }

  getTransactionType(tx: WalletTransaction): 'sent' | 'received' {
    return tx.result < 0 ? 'sent' : 'received';
  }

  getTransactionStatus(
    tx: WalletTransaction
  ): 'pending-incoming' | 'pending-outgoing' | 'incoming' | 'outgoing' {
    if (!tx.blockHeight) {
      return tx.result >= 0 ? 'pending-incoming' : 'pending-outgoing';
    }
    return tx.result >= 0 ? 'incoming' : 'outgoing';
  }

  getStatusIcon(status: 'pending-incoming' | 'pending-outgoing' | 'incoming' | 'outgoing'): string {
    switch (status) {
      case 'pending-incoming':
      case 'pending-outgoing':
        return 'sync';
      case 'incoming':
        return 'south_east';
      case 'outgoing':
        return 'north_east';
    }
  }

  getPrimaryFromAddress(tx: WalletTransaction): string {
    const firstInput = tx.inputs.find((i) => i.address);
    return firstInput?.address ?? '';
  }

  getFromAddressSummary(tx: WalletTransaction): { address: string; count: number } {
    const addresses = tx.inputs.filter((i) => i.address).map((i) => i.address!);
    const uniqueAddresses = [...new Set(addresses)];
    return {
      address: uniqueAddresses[0] ?? '',
      count: uniqueAddresses.length,
    };
  }

  getToAddressSummary(tx: WalletTransaction): { address: string; count: number } {
    const addresses = tx.outputs.filter((o) => o.address).map((o) => o.address!);
    const uniqueAddresses = [...new Set(addresses)];
    return {
      address: uniqueAddresses[0] ?? '',
      count: uniqueAddresses.length,
    };
  }

  getTruncatedTxHash(hash: string): string {
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  }

  copyToClipboard(text: string, event?: Event): void {
    event?.stopPropagation();
    this.#clipboard.copy(text);
    this.#snackBar.open(this.#translate.instant('dashboard.receive.copied'), undefined, {
      duration: 2000,
    });
  }

  satoshisToEur(satoshis: number): number | null {
    return this.#walletSession.satoshisToEur(satoshis);
  }

  onReceiveMenuOpen(): void {
    const address = this.#walletSession.getFirstUnusedAddress();
    this.receiveAddress.set(address);
  }

  copyAddress(): void {
    const address = this.receiveAddress()?.address;
    if (address) {
      this.#clipboard.copy(address);
      this.#snackBar.open(this.#translate.instant('dashboard.receive.copied'), undefined, {
        duration: 2000,
      });
    }
  }

  refreshWallet(): void {
    this.#walletSession.refreshBalance();
  }

  openSendDialog(): void {
    const dialogRef = this.#dialog.open(SendDialog, {
      width: '520px',
      disableClose: false,
      autoFocus: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.success) {
        // Refresh wallet after successful send
        this.#walletSession.refreshBalance();
      }
    });
  }
}
