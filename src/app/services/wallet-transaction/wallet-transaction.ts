import { inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import * as bitcoin from 'bitcoinjs-lib';
import { ecc } from '../../lib/noble-ecc';
import { Buffer } from 'buffer';
import { BitcoinService } from '../bitcoin';
import { BlockchainApiService, FeeEstimates } from '../blockchain-api';
import { WalletSessionService } from '../wallet-session';
import { DerivedAddress, UTXO } from '../../interfaces';

// Initialize bitcoinjs-lib with ecc library
bitcoin.initEccLib(ecc);

/**
 * Priority levels for transaction fees.
 */
export type FeePriority = 'fastest' | 'halfHour' | 'hour' | 'economy' | 'custom';

/**
 * Validation error types for send transactions.
 */
export type SendValidationError =
  | 'INVALID_ADDRESS'
  | 'INVALID_AMOUNT'
  | 'AMOUNT_TOO_SMALL'
  | 'INSUFFICIENT_FUNDS'
  | 'INSUFFICIENT_FOR_FEE'
  | 'NO_UTXOS'
  | 'NO_MNEMONIC';

/**
 * Result of coin selection.
 */
export interface CoinSelectionResult {
  selectedUtxos: UTXO[];
  totalInputValue: number;
  fee: number;
  changeAmount: number;
  changeAddress: DerivedAddress | null;
  dustAddedToFee: number;
}

/**
 * Prepared transaction ready for signing.
 */
export interface PreparedTransaction {
  coinSelection: CoinSelectionResult;
  targetAddress: string;
  amountSatoshis: number;
  feeRate: number;
  estimatedSize: number;
}

/**
 * Result of broadcasting a transaction.
 */
export interface BroadcastResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Validation result for send parameters.
 */
export interface SendValidation {
  valid: boolean;
  error?: SendValidationError;
  errorMessage?: string;
}

/**
 * Input details for transaction preview.
 */
export interface PreviewInput {
  address: string;
  valueSatoshis: number;
}

/**
 * Output details for transaction preview.
 */
export interface PreviewOutput {
  address: string;
  valueSatoshis: number;
  isChange: boolean;
}

/**
 * Transaction preview with all details for user confirmation.
 */
export interface TransactionPreview {
  targetAddress: string;
  amountSatoshis: number;
  amountBtc: number;
  feeSatoshis: number;
  feeBtc: number;
  feePercent: number;
  feeRate: number;
  totalSatoshis: number;
  totalBtc: number;
  changeAmount: number;
  dustAddedToFee: number;
  inputCount: number;
  outputCount: number;
  estimatedSize: number;
  inputs: PreviewInput[];
  outputs: PreviewOutput[];
}

// P2WPKH input size: ~68 vbytes (witness data is discounted)
const P2WPKH_INPUT_SIZE = 68;
// P2WPKH output size: 31 vbytes
const P2WPKH_OUTPUT_SIZE = 31;
// Transaction overhead: ~10.5 vbytes
const TX_OVERHEAD = 11;
// Dust threshold in satoshis (below this, change is not economical)
const DUST_THRESHOLD = 546;
// Minimum sendable amount
const MIN_SEND_AMOUNT = 546;
// Fee warning threshold (warn if fee > 10% of amount)
const FEE_WARNING_PERCENT = 10;

@Injectable({
  providedIn: 'root',
})
export class WalletTransactionService {
  readonly #bitcoinService = inject(BitcoinService);
  readonly #blockchainApi = inject(BlockchainApiService);
  readonly #walletSession = inject(WalletSessionService);

  // Track locked UTXOs (pending transactions)
  readonly #lockedUtxos = signal<Set<string>>(new Set());

  /**
   * Get current fee estimates from the network.
   */
  getFeeEstimates(): Observable<FeeEstimates> {
    return this.#blockchainApi.getFeeEstimates();
  }

  /**
   * Validate a Bitcoin address.
   */
  validateAddress(address: string): boolean {
    return this.#bitcoinService.validateAddress(address, 'mainnet');
  }

  /**
   * Validate send parameters before preparing transaction.
   */
  validateSend(address: string, amountSatoshis: number, feeRate: number): SendValidation {
    // Check address
    if (!address || !this.validateAddress(address)) {
      return {
        valid: false,
        error: 'INVALID_ADDRESS',
        errorMessage: 'Invalid Bitcoin address',
      };
    }

    // Check amount
    if (!amountSatoshis || amountSatoshis <= 0 || !Number.isFinite(amountSatoshis)) {
      return {
        valid: false,
        error: 'INVALID_AMOUNT',
        errorMessage: 'Invalid amount',
      };
    }

    if (amountSatoshis < MIN_SEND_AMOUNT) {
      return {
        valid: false,
        error: 'AMOUNT_TOO_SMALL',
        errorMessage: `Amount must be at least ${MIN_SEND_AMOUNT} satoshis`,
      };
    }

    // Check mnemonic
    if (!this.#walletSession.mnemonic()) {
      return {
        valid: false,
        error: 'NO_MNEMONIC',
        errorMessage: 'Wallet not loaded',
      };
    }

    // Check UTXOs
    const spendableUtxos = this.getSpendableUtxos();
    if (spendableUtxos.length === 0) {
      return {
        valid: false,
        error: 'NO_UTXOS',
        errorMessage: 'No spendable funds available',
      };
    }

    // Check if amount + fee can be covered
    const totalSpendable = spendableUtxos.reduce((sum, u) => sum + u.value, 0);
    const minFee = this.calculateFee(1, 1, feeRate);

    if (amountSatoshis > totalSpendable) {
      return {
        valid: false,
        error: 'INSUFFICIENT_FUNDS',
        errorMessage: 'Insufficient funds',
      };
    }

    if (amountSatoshis + minFee > totalSpendable) {
      return {
        valid: false,
        error: 'INSUFFICIENT_FOR_FEE',
        errorMessage: 'Insufficient funds to cover transaction fee',
      };
    }

    return { valid: true };
  }

  /**
   * Get spendable UTXOs (confirmed and not locked).
   */
  getSpendableUtxos(): UTXO[] {
    const lockedSet = this.#lockedUtxos();
    return this.#walletSession
      .getSpendableUtxos()
      .filter((utxo) => !lockedSet.has(this.#getUtxoKey(utxo)));
  }

  /**
   * Get spendable balance (excluding locked UTXOs).
   */
  getSpendableBalance(): number {
    return this.getSpendableUtxos().reduce((sum, utxo) => sum + utxo.value, 0);
  }

  /**
   * Calculate the fee for a transaction with given number of inputs and outputs.
   */
  calculateFee(numInputs: number, numOutputs: number, feeRate: number): number {
    const txSize = TX_OVERHEAD + numInputs * P2WPKH_INPUT_SIZE + numOutputs * P2WPKH_OUTPUT_SIZE;
    return Math.ceil(txSize * feeRate);
  }

  /**
   * Estimate transaction size in virtual bytes.
   */
  estimateTxSize(numInputs: number, numOutputs: number): number {
    return TX_OVERHEAD + numInputs * P2WPKH_INPUT_SIZE + numOutputs * P2WPKH_OUTPUT_SIZE;
  }

  /**
   * Select UTXOs for a transaction using a greedy algorithm.
   * Considers effective value (UTXO value minus input cost).
   */
  selectCoins(amountSatoshis: number, feeRate: number): CoinSelectionResult | null {
    const spendableUtxos = this.getSpendableUtxos();

    if (spendableUtxos.length === 0) {
      return null;
    }

    // Calculate effective value for each UTXO (value minus cost to spend it)
    const inputCost = P2WPKH_INPUT_SIZE * feeRate;
    const utxosWithEffectiveValue = spendableUtxos
      .map((utxo) => ({
        utxo,
        effectiveValue: utxo.value - inputCost,
      }))
      .filter((u) => u.effectiveValue > 0) // Skip uneconomical UTXOs
      .sort((a, b) => b.effectiveValue - a.effectiveValue); // Largest first

    if (utxosWithEffectiveValue.length === 0) {
      return null;
    }

    const selectedUtxos: UTXO[] = [];
    let totalInputValue = 0;

    for (const { utxo } of utxosWithEffectiveValue) {
      selectedUtxos.push(utxo);
      totalInputValue += utxo.value;

      // Calculate fee with potential change output
      const feeWithChange = this.calculateFee(selectedUtxos.length, 2, feeRate);
      const feeWithoutChange = this.calculateFee(selectedUtxos.length, 1, feeRate);

      const remainingWithChange = totalInputValue - amountSatoshis - feeWithChange;
      const remainingWithoutChange = totalInputValue - amountSatoshis - feeWithoutChange;

      // If we have enough for amount + fee + change above dust
      if (remainingWithChange >= DUST_THRESHOLD) {
        const changeAddress = this.#walletSession.getNextChangeAddress();
        return {
          selectedUtxos,
          totalInputValue,
          fee: feeWithChange,
          changeAmount: remainingWithChange,
          changeAddress,
          dustAddedToFee: 0,
        };
      }

      // If we have enough for amount + fee but change would be dust
      if (remainingWithoutChange >= 0) {
        const dustAmount = remainingWithoutChange > 0 ? remainingWithoutChange : 0;
        return {
          selectedUtxos,
          totalInputValue,
          fee: totalInputValue - amountSatoshis, // All remaining goes to fee
          changeAmount: 0,
          changeAddress: null,
          dustAddedToFee: dustAmount,
        };
      }
    }

    // Not enough funds
    return null;
  }

  /**
   * Calculate the maximum amount that can be sent with the given fee rate.
   */
  getMaxSendableAmount(feeRate: number): number {
    const spendableUtxos = this.getSpendableUtxos();

    if (spendableUtxos.length === 0) {
      return 0;
    }

    const totalValue = spendableUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    const fee = this.calculateFee(spendableUtxos.length, 1, feeRate); // 1 output (no change)

    return Math.max(0, totalValue - fee);
  }

  /**
   * Get fee rate for a priority level.
   */
  getFeeRateForPriority(estimates: FeeEstimates, priority: FeePriority): number {
    switch (priority) {
      case 'fastest':
        return estimates.fastestFee;
      case 'halfHour':
        return estimates.halfHourFee;
      case 'hour':
        return estimates.hourFee;
      case 'economy':
        return estimates.economyFee;
      case 'custom':
        return estimates.hourFee; // Default fallback
    }
  }

  /**
   * Create a transaction preview for user confirmation.
   */
  createPreview(
    targetAddress: string,
    amountSatoshis: number,
    feeRate: number
  ): TransactionPreview | null {
    const coinSelection = this.selectCoins(amountSatoshis, feeRate);

    if (!coinSelection) {
      return null;
    }

    const outputCount = coinSelection.changeAmount > 0 ? 2 : 1;
    const estimatedSize = this.estimateTxSize(coinSelection.selectedUtxos.length, outputCount);
    const feePercent = (coinSelection.fee / amountSatoshis) * 100;

    // Build inputs array from selected UTXOs
    const inputs: PreviewInput[] = coinSelection.selectedUtxos.map((utxo) => ({
      address: utxo.address,
      valueSatoshis: utxo.value,
    }));

    // Build outputs array
    const outputs: PreviewOutput[] = [
      {
        address: targetAddress,
        valueSatoshis: amountSatoshis,
        isChange: false,
      },
    ];

    // Add change output if applicable
    if (coinSelection.changeAmount > 0 && coinSelection.changeAddress) {
      outputs.push({
        address: coinSelection.changeAddress.address,
        valueSatoshis: coinSelection.changeAmount,
        isChange: true,
      });
    }

    return {
      targetAddress,
      amountSatoshis,
      amountBtc: amountSatoshis / 100_000_000,
      feeSatoshis: coinSelection.fee,
      feeBtc: coinSelection.fee / 100_000_000,
      feePercent,
      feeRate,
      totalSatoshis: amountSatoshis + coinSelection.fee,
      totalBtc: (amountSatoshis + coinSelection.fee) / 100_000_000,
      changeAmount: coinSelection.changeAmount,
      dustAddedToFee: coinSelection.dustAddedToFee,
      inputCount: coinSelection.selectedUtxos.length,
      outputCount,
      estimatedSize,
      inputs,
      outputs,
    };
  }

  /**
   * Check if fee is unusually high (warning threshold).
   */
  isFeeWarning(feeSatoshis: number, amountSatoshis: number): boolean {
    const feePercent = (feeSatoshis / amountSatoshis) * 100;
    return feePercent > FEE_WARNING_PERCENT;
  }

  /**
   * Prepare a transaction for signing.
   */
  prepareTransaction(
    targetAddress: string,
    amountSatoshis: number,
    feeRate: number
  ): PreparedTransaction | null {
    const coinSelection = this.selectCoins(amountSatoshis, feeRate);

    if (!coinSelection) {
      return null;
    }

    const outputCount = coinSelection.changeAmount > 0 ? 2 : 1;

    return {
      coinSelection,
      targetAddress,
      amountSatoshis,
      feeRate,
      estimatedSize: this.estimateTxSize(coinSelection.selectedUtxos.length, outputCount),
    };
  }

  /**
   * Build and sign a transaction.
   */
  signTransaction(prepared: PreparedTransaction): string {
    const mnemonic = this.#walletSession.mnemonic();
    if (!mnemonic) {
      throw new Error('No mnemonic available');
    }

    const network = bitcoin.networks.bitcoin;
    const psbt = new bitcoin.Psbt({ network });

    // Build key pairs for all inputs
    const keyPairs: { privateKey: Buffer; publicKey: Buffer }[] = [];

    // Add inputs
    for (const utxo of prepared.coinSelection.selectedUtxos) {
      const privateKey = this.#bitcoinService.getPrivateKeyForPath(mnemonic, utxo.derivationPath);
      const publicKeyBytes = ecc.pointFromScalar(privateKey);
      if (!publicKeyBytes) {
        throw new Error('Failed to derive public key');
      }
      const publicKey = Buffer.from(publicKeyBytes);
      keyPairs.push({ privateKey, publicKey });

      const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: publicKey,
        network,
      });

      psbt.addInput({
        hash: utxo.txHash,
        index: utxo.outputIndex,
        witnessUtxo: {
          script: p2wpkh.output!,
          value: BigInt(utxo.value),
        },
      });
    }

    // Add recipient output
    psbt.addOutput({
      address: prepared.targetAddress,
      value: BigInt(prepared.amountSatoshis),
    });

    // Add change output if applicable
    if (
      prepared.coinSelection.changeAmount > 0 &&
      prepared.coinSelection.changeAddress
    ) {
      psbt.addOutput({
        address: prepared.coinSelection.changeAddress.address,
        value: BigInt(prepared.coinSelection.changeAmount),
      });
    }

    // Sign all inputs
    for (let i = 0; i < keyPairs.length; i++) {
      const { privateKey, publicKey } = keyPairs[i];
      psbt.signInput(i, {
        publicKey,
        sign: (hash: Uint8Array) => Buffer.from(ecc.sign(hash, privateKey)),
      });
    }

    // Finalize and extract
    psbt.finalizeAllInputs();
    return psbt.extractTransaction().toHex();
  }

  /**
   * Lock UTXOs used in a pending transaction.
   */
  lockUtxos(utxos: UTXO[]): void {
    const newSet = new Set(this.#lockedUtxos());
    for (const utxo of utxos) {
      newSet.add(this.#getUtxoKey(utxo));
    }
    this.#lockedUtxos.set(newSet);
  }

  /**
   * Unlock UTXOs (e.g., if transaction fails or is dropped).
   */
  unlockUtxos(utxos: UTXO[]): void {
    const newSet = new Set(this.#lockedUtxos());
    for (const utxo of utxos) {
      newSet.delete(this.#getUtxoKey(utxo));
    }
    this.#lockedUtxos.set(newSet);
  }

  /**
   * Clear all locked UTXOs.
   */
  clearLockedUtxos(): void {
    this.#lockedUtxos.set(new Set());
  }

  /**
   * Broadcast a signed transaction to the network.
   */
  broadcastTransaction(txHex: string, usedUtxos: UTXO[]): Observable<BroadcastResult> {
    // Lock the UTXOs before broadcasting
    this.lockUtxos(usedUtxos);

    return this.#blockchainApi.broadcastTransaction(txHex).pipe(
      map((txHash) => ({
        success: true,
        txHash: txHash.trim(),
      })),
      tap((result) => {
        if (result.success) {
          // Refresh wallet after successful broadcast
          this.#walletSession.refreshBalance();
        }
      }),
      catchError((error) => {
        // Unlock UTXOs on failure
        this.unlockUtxos(usedUtxos);
        return of({
          success: false,
          error: error?.error || error?.message || 'Broadcast failed',
        });
      })
    );
  }

  /**
   * Complete flow: prepare, sign, and broadcast a transaction.
   */
  sendTransaction(
    targetAddress: string,
    amountSatoshis: number,
    feeRate: number
  ): Observable<BroadcastResult> {
    const prepared = this.prepareTransaction(targetAddress, amountSatoshis, feeRate);

    if (!prepared) {
      return of({ success: false, error: 'Insufficient funds' });
    }

    try {
      const txHex = this.signTransaction(prepared);
      return this.broadcastTransaction(txHex, prepared.coinSelection.selectedUtxos);
    } catch (error) {
      return of({
        success: false,
        error: error instanceof Error ? error.message : 'Transaction signing failed',
      });
    }
  }

  #getUtxoKey(utxo: UTXO): string {
    return `${utxo.txHash}:${utxo.outputIndex}`;
  }
}
