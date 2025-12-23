import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { TranslateModule } from '@ngx-translate/core';
import { WalletSessionService } from '../../services/wallet-session';
import { WalletTransaction } from '../../interfaces';

@Component({
  selector: 'app-address-detail',
  imports: [DatePipe, DecimalPipe, MatButtonModule, MatIconModule, MatListModule, TranslateModule],
  templateUrl: './address-detail.html',
  styleUrl: './address-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressDetail {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #walletSession = inject(WalletSessionService);

  readonly address = toSignal(this.#route.paramMap.pipe(map((params) => params.get('address'))));

  readonly addressInfo = computed(() => {
    const addr = this.address();
    if (!addr) return null;
    return this.#walletSession.usedAddresses().find((a) => a.address === addr) ?? null;
  });

  readonly isOwnAddress = computed(() => this.addressInfo() !== null);

  readonly transactions = computed(() => {
    const addr = this.address();
    if (!addr) return [];
    return this.#walletSession.transactions().filter((tx) => this.#isAddressInTransaction(tx, addr));
  });

  goBack(): void {
    this.#router.navigate(['/']);
  }

  satoshisToBtc(satoshis: number): number {
    return this.#walletSession.satoshisToBtc(satoshis);
  }

  formatDate(timestamp: number): Date {
    return new Date(timestamp * 1000);
  }

  getTransactionStatus(
    tx: WalletTransaction,
    address: string
  ): 'pending' | 'incoming' | 'outgoing' {
    // Pending if no block height
    if (!tx.blockHeight) {
      return 'pending';
    }

    // Check if this address is in inputs (sender) or outputs (receiver)
    const isInInputs = tx.inputs.some((input) => input.address === address);
    const isInOutputs = tx.outputs.some((output) => output.address === address);

    // If address is only in outputs, it's incoming
    if (isInOutputs && !isInInputs) {
      return 'incoming';
    }

    // If address is in inputs, it's outgoing
    if (isInInputs) {
      return 'outgoing';
    }

    // Default to incoming if somehow in transaction
    return 'incoming';
  }

  getStatusIcon(status: 'pending' | 'incoming' | 'outgoing'): string {
    switch (status) {
      case 'pending':
        return 'sync';
      case 'incoming':
        return 'south_east';
      case 'outgoing':
        return 'north_east';
    }
  }

  getTransactionAmount(tx: WalletTransaction, address: string): number {
    const status = this.getTransactionStatus(tx, address);

    if (status === 'outgoing') {
      // Sum of inputs from this address
      const inputSum = tx.inputs
        .filter((input) => input.address === address)
        .reduce((sum, input) => sum + input.value, 0);
      // Subtract any change returned to this address
      const changeSum = tx.outputs
        .filter((output) => output.address === address)
        .reduce((sum, output) => sum + output.value, 0);
      return -(inputSum - changeSum);
    } else {
      // Sum of outputs to this address
      return tx.outputs
        .filter((output) => output.address === address)
        .reduce((sum, output) => sum + output.value, 0);
    }
  }

  #isAddressInTransaction(tx: WalletTransaction, address: string): boolean {
    return (
      tx.inputs.some((input) => input.address === address) ||
      tx.outputs.some((output) => output.address === address)
    );
  }
}
