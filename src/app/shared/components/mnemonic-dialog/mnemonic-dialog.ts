import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { BitcoinService } from '../../../services/bitcoin';

export interface MnemonicDialogResult {
  action: 'continue' | 'dismiss';
  mnemonic?: string;
}

@Component({
  selector: 'app-mnemonic-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    TranslateModule,
  ],
  templateUrl: './mnemonic-dialog.html',
  styleUrl: './mnemonic-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MnemonicDialog {
  #dialogRef = inject(MatDialogRef<MnemonicDialog, MnemonicDialogResult>);
  #bitcoinService = inject(BitcoinService);

  mnemonic = signal('');
  error = signal('');

  onMnemonicInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.mnemonic.set(input.value);
    this.error.set('');
  }

  onContinue(): void {
    const mnemonic = this.mnemonic().trim();

    if (!mnemonic) {
      this.error.set('dashboard.mnemonic.errorEmpty');
      return;
    }

    if (!this.#bitcoinService.validateMnemonic(mnemonic)) {
      this.error.set('dashboard.mnemonic.errorInvalid');
      return;
    }

    this.#dialogRef.close({
      action: 'continue',
      mnemonic,
    });
  }

  onDismiss(): void {
    this.#dialogRef.close({
      action: 'dismiss',
    });
  }
}
