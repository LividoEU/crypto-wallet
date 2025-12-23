import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BitcoinService } from '../../../services/bitcoin';

export interface WalletCreationDialogResult {
  action: 'login' | 'close';
  mnemonic?: string;
}

@Component({
  selector: 'app-wallet-creation-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  templateUrl: './wallet-creation-dialog.html',
  styleUrl: './wallet-creation-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletCreationDialog implements OnInit {
  #dialogRef = inject(MatDialogRef<WalletCreationDialog, WalletCreationDialogResult>);
  #bitcoinService = inject(BitcoinService);
  #clipboard = inject(Clipboard);
  #snackBar = inject(MatSnackBar);
  #translate = inject(TranslateService);

  mnemonic = signal('');
  hasCopied = signal(false);

  ngOnInit(): void {
    const wallet = this.#bitcoinService.createWallet('mainnet');
    this.mnemonic.set(wallet.mnemonic);
  }

  copyMnemonic(): void {
    this.#clipboard.copy(this.mnemonic());
    this.#snackBar.open(
      this.#translate.instant('walletCreation.copied'),
      undefined,
      { duration: 2000 }
    );
  }

  onCheckboxChange(checked: boolean): void {
    this.hasCopied.set(checked);
  }

  onLogin(): void {
    this.#dialogRef.close({
      action: 'login',
      mnemonic: this.mnemonic(),
    });
  }

  onClose(): void {
    this.#dialogRef.close({
      action: 'close',
    });
  }
}
