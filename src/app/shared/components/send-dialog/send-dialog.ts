import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeeEstimates } from '../../../services/blockchain-api';
import {
  WalletTransactionService,
  FeePriority,
  TransactionPreview,
  BroadcastResult,
} from '../../../services/wallet-transaction';
import { WalletSessionService } from '../../../services/wallet-session';

type DialogStep = 'input' | 'confirm' | 'broadcasting' | 'result';

interface FeeOption {
  priority: FeePriority;
  label: string;
  rate: number;
  description: string;
}

@Component({
  selector: 'app-send-dialog',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    TranslateModule,
  ],
  templateUrl: './send-dialog.html',
  styleUrl: './send-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendDialog implements OnInit {
  readonly #dialogRef = inject(MatDialogRef<SendDialog>);
  readonly #fb = inject(FormBuilder);
  readonly #txService = inject(WalletTransactionService);
  readonly #walletSession = inject(WalletSessionService);
  readonly #translate = inject(TranslateService);

  // Form
  readonly sendForm = this.#fb.group({
    address: ['', [Validators.required]],
    amountBtc: ['', [Validators.required, Validators.min(0.00000546)]],
    feePriority: ['halfHour' as FeePriority],
    customFeeRate: [{ value: '', disabled: true }],
  });

  // State
  readonly step = signal<DialogStep>('input');
  readonly isLoading = signal(false);
  readonly feeEstimates = signal<FeeEstimates | null>(null);
  readonly preview = signal<TransactionPreview | null>(null);
  readonly broadcastResult = signal<BroadcastResult | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // Computed
  readonly spendableBalance = computed(() => this.#txService.getSpendableBalance());
  readonly spendableBalanceBtc = computed(() => this.spendableBalance() / 100_000_000);

  readonly eurPrice = this.#walletSession.eurPrice;

  readonly amountEur = computed(() => {
    const amountBtc = parseFloat(this.sendForm.get('amountBtc')?.value || '0');
    const price = this.eurPrice();
    if (!price || isNaN(amountBtc)) return null;
    return amountBtc * price;
  });

  readonly feeOptions = computed((): FeeOption[] => {
    const estimates = this.feeEstimates();
    if (!estimates) return [];

    return [
      {
        priority: 'fastest',
        label: this.#translate.instant('send.fee.fastest'),
        rate: estimates.fastestFee,
        description: '~10 min',
      },
      {
        priority: 'halfHour',
        label: this.#translate.instant('send.fee.normal'),
        rate: estimates.halfHourFee,
        description: '~30 min',
      },
      {
        priority: 'hour',
        label: this.#translate.instant('send.fee.slow'),
        rate: estimates.hourFee,
        description: '~60 min',
      },
      {
        priority: 'economy',
        label: this.#translate.instant('send.fee.economy'),
        rate: estimates.economyFee,
        description: '1+ hours',
      },
    ];
  });

  readonly selectedFeeRate = computed(() => {
    const priority = this.sendForm.get('feePriority')?.value as FeePriority;
    const estimates = this.feeEstimates();

    if (priority === 'custom') {
      const customRate = parseFloat(this.sendForm.get('customFeeRate')?.value || '0');
      return customRate > 0 ? customRate : 1;
    }

    if (!estimates) return 1;
    return this.#txService.getFeeRateForPriority(estimates, priority);
  });

  readonly estimatedFee = computed(() => {
    const amountBtc = parseFloat(this.sendForm.get('amountBtc')?.value || '0');
    if (isNaN(amountBtc) || amountBtc <= 0) return null;

    const amountSatoshis = Math.round(amountBtc * 100_000_000);
    const feeRate = this.selectedFeeRate();

    const preview = this.#txService.createPreview('', amountSatoshis, feeRate);
    return preview?.feeSatoshis ?? null;
  });

  readonly estimatedFeeBtc = computed(() => {
    const fee = this.estimatedFee();
    return fee ? fee / 100_000_000 : null;
  });

  readonly estimatedTotal = computed(() => {
    const amountBtc = parseFloat(this.sendForm.get('amountBtc')?.value || '0');
    const fee = this.estimatedFee();
    if (isNaN(amountBtc) || amountBtc <= 0 || !fee) return null;
    return Math.round(amountBtc * 100_000_000) + fee;
  });

  readonly estimatedTotalBtc = computed(() => {
    const total = this.estimatedTotal();
    return total ? total / 100_000_000 : null;
  });

  readonly maxSendable = computed(() => {
    const feeRate = this.selectedFeeRate();
    return this.#txService.getMaxSendableAmount(feeRate);
  });

  readonly maxSendableBtc = computed(() => this.maxSendable() / 100_000_000);

  readonly isFeeWarning = computed(() => {
    const amountBtc = parseFloat(this.sendForm.get('amountBtc')?.value || '0');
    const fee = this.estimatedFee();
    if (!fee || isNaN(amountBtc) || amountBtc <= 0) return false;

    const amountSatoshis = Math.round(amountBtc * 100_000_000);
    return this.#txService.isFeeWarning(fee, amountSatoshis);
  });

  ngOnInit(): void {
    this.#loadFeeEstimates();

    // Handle custom fee toggle
    this.sendForm.get('feePriority')?.valueChanges.subscribe((priority) => {
      const customFeeControl = this.sendForm.get('customFeeRate');
      if (priority === 'custom') {
        customFeeControl?.enable();
      } else {
        customFeeControl?.disable();
      }
    });
  }

  #loadFeeEstimates(): void {
    this.isLoading.set(true);
    this.#txService.getFeeEstimates().subscribe({
      next: (estimates) => {
        this.feeEstimates.set(estimates);
        this.isLoading.set(false);
      },
      error: () => {
        // Use fallback fee rates
        this.feeEstimates.set({
          fastestFee: 50,
          halfHourFee: 25,
          hourFee: 10,
          economyFee: 5,
          minimumFee: 1,
        });
        this.isLoading.set(false);
      },
    });
  }

  setMaxAmount(): void {
    const maxBtc = this.maxSendableBtc();
    if (maxBtc > 0) {
      this.sendForm.get('amountBtc')?.setValue(maxBtc.toFixed(8));
    }
  }

  validateAndPreview(): void {
    this.errorMessage.set(null);

    const address = this.sendForm.get('address')?.value?.trim() || '';
    const amountBtc = parseFloat(this.sendForm.get('amountBtc')?.value || '0');
    const feeRate = this.selectedFeeRate();

    if (!address) {
      this.errorMessage.set(this.#translate.instant('send.error.addressRequired'));
      return;
    }

    if (isNaN(amountBtc) || amountBtc <= 0) {
      this.errorMessage.set(this.#translate.instant('send.error.amountRequired'));
      return;
    }

    const amountSatoshis = Math.round(amountBtc * 100_000_000);

    // Validate
    const validation = this.#txService.validateSend(address, amountSatoshis, feeRate);
    if (!validation.valid) {
      this.errorMessage.set(this.#getValidationErrorMessage(validation.error!));
      return;
    }

    // Create preview
    const preview = this.#txService.createPreview(address, amountSatoshis, feeRate);
    if (!preview) {
      this.errorMessage.set(this.#translate.instant('send.error.cannotCreateTransaction'));
      return;
    }

    this.preview.set(preview);
    this.step.set('confirm');
  }

  confirmAndSend(): void {
    const txPreview = this.preview();
    if (!txPreview) return;

    this.step.set('broadcasting');

    this.#txService
      .sendTransaction(txPreview.targetAddress, txPreview.amountSatoshis, txPreview.feeRate)
      .subscribe({
        next: (result) => {
          this.broadcastResult.set(result);
          this.step.set('result');
        },
        error: (err) => {
          this.broadcastResult.set({
            success: false,
            error: err?.message || 'Unknown error',
          });
          this.step.set('result');
        },
      });
  }

  goBack(): void {
    const currentStep = this.step();
    if (currentStep === 'confirm') {
      this.step.set('input');
      this.preview.set(null);
    }
  }

  close(): void {
    this.#dialogRef.close(this.broadcastResult());
  }

  satoshisToBtc(satoshis: number): number {
    return satoshis / 100_000_000;
  }

  satoshisToEur(satoshis: number): number | null {
    const price = this.eurPrice();
    if (!price) return null;
    return this.satoshisToBtc(satoshis) * price;
  }

  #getValidationErrorMessage(error: string): string {
    const key = `send.error.${error.toLowerCase().replace(/_/g, '')}`;
    const translated = this.#translate.instant(key);
    return translated !== key ? translated : error;
  }
}

export interface SendDialogResult {
  success: boolean;
  txHash?: string;
}
