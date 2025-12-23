import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
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
export type FeePriority = 'fastest' | 'halfHour' | 'hour' | 'economy';

/**
 * Result of coin selection.
 */
export interface CoinSelectionResult {
  selectedUtxos: UTXO[];
  totalInputValue: number;
  fee: number;
  changeAmount: number;
  changeAddress: DerivedAddress | null;
}

/**
 * Prepared transaction ready for signing.
 */
export interface PreparedTransaction {
  coinSelection: CoinSelectionResult;
  targetAddress: string;
  amountSatoshis: number;
  feeRate: number;
}

/**
 * Result of broadcasting a transaction.
 */
export interface BroadcastResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

// P2WPKH input size: ~68 vbytes (witness data is discounted)
const P2WPKH_INPUT_SIZE = 68;
// P2WPKH output size: 31 vbytes
const P2WPKH_OUTPUT_SIZE = 31;
// Transaction overhead: ~10.5 vbytes
const TX_OVERHEAD = 11;
// Dust threshold in satoshis (below this, change is not economical)
const DUST_THRESHOLD = 546;

@Injectable({
  providedIn: 'root',
})
export class WalletTransactionService {
  readonly #bitcoinService = inject(BitcoinService);
  readonly #blockchainApi = inject(BlockchainApiService);
  readonly #walletSession = inject(WalletSessionService);

  /**
   * Get current fee estimates from the network.
   */
  getFeeEstimates(): Observable<FeeEstimates> {
    return this.#blockchainApi.getFeeEstimates();
  }

  /**
   * Calculate the fee for a transaction with given number of inputs and outputs.
   * @param numInputs Number of inputs
   * @param numOutputs Number of outputs
   * @param feeRate Fee rate in sat/vB
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
   * Select UTXOs for a transaction using a simple greedy algorithm.
   * Selects largest UTXOs first to minimize the number of inputs.
   * @param amountSatoshis Target amount to send
   * @param feeRate Fee rate in sat/vB
   * @returns Coin selection result or null if insufficient funds
   */
  selectCoins(amountSatoshis: number, feeRate: number): CoinSelectionResult | null {
    const spendableUtxos = this.#walletSession.getSpendableUtxos();

    if (spendableUtxos.length === 0) {
      return null;
    }

    // Sort UTXOs by value descending (largest first)
    const sortedUtxos = [...spendableUtxos].sort((a, b) => b.value - a.value);

    const selectedUtxos: UTXO[] = [];
    let totalInputValue = 0;

    // Start with 1 output (recipient), may add change output later
    for (const utxo of sortedUtxos) {
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
        };
      }

      // If we have enough for amount + fee but change would be dust
      if (remainingWithoutChange >= 0) {
        return {
          selectedUtxos,
          totalInputValue,
          fee: totalInputValue - amountSatoshis, // All remaining goes to fee
          changeAmount: 0,
          changeAddress: null,
        };
      }
    }

    // Not enough funds
    return null;
  }

  /**
   * Calculate the maximum amount that can be sent with the given fee rate.
   * @param feeRate Fee rate in sat/vB
   * @returns Maximum sendable amount in satoshis, or 0 if no UTXOs
   */
  getMaxSendableAmount(feeRate: number): number {
    const spendableUtxos = this.#walletSession.getSpendableUtxos();

    if (spendableUtxos.length === 0) {
      return 0;
    }

    const totalValue = spendableUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    const fee = this.calculateFee(spendableUtxos.length, 1, feeRate); // 1 output (no change)

    return Math.max(0, totalValue - fee);
  }

  /**
   * Prepare a transaction for signing.
   * @param targetAddress The recipient address
   * @param amountSatoshis Amount to send in satoshis
   * @param priority Fee priority level
   */
  prepareTransaction(
    targetAddress: string,
    amountSatoshis: number,
    priority: FeePriority = 'halfHour'
  ): Observable<PreparedTransaction | null> {
    return this.getFeeEstimates().pipe(
      map((estimates) => {
        const feeRate = this.#getFeeRateForPriority(estimates, priority);
        const coinSelection = this.selectCoins(amountSatoshis, feeRate);

        if (!coinSelection) {
          return null;
        }

        return {
          coinSelection,
          targetAddress,
          amountSatoshis,
          feeRate,
        };
      })
    );
  }

  /**
   * Build and sign a transaction.
   * @param prepared Prepared transaction from prepareTransaction
   * @returns Signed transaction hex
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
      const publicKey = Buffer.from(ecc.pointFromScalar(privateKey)!);
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
        sign: (hash: Buffer) => Buffer.from(ecc.sign(hash, privateKey)),
      });
    }

    // Finalize and extract
    psbt.finalizeAllInputs();
    return psbt.extractTransaction().toHex();
  }

  /**
   * Broadcast a signed transaction to the network.
   * @param txHex Signed transaction in hex format
   */
  broadcastTransaction(txHex: string): Observable<BroadcastResult> {
    return this.#blockchainApi.broadcastTransaction(txHex).pipe(
      map((txHash) => ({
        success: true,
        txHash: txHash.trim(),
      })),
      switchMap((result) => {
        // Refresh wallet after broadcast
        this.#walletSession.refreshBalance();
        return of(result);
      }),
      catchError((error) => {
        return of({
          success: false,
          error: error?.message ?? 'Broadcast failed',
        });
      })
    );
  }

  /**
   * Complete flow: prepare, sign, and broadcast a transaction.
   * @param targetAddress The recipient address
   * @param amountSatoshis Amount to send in satoshis
   * @param priority Fee priority level
   */
  sendTransaction(
    targetAddress: string,
    amountSatoshis: number,
    priority: FeePriority = 'halfHour'
  ): Observable<BroadcastResult> {
    return this.prepareTransaction(targetAddress, amountSatoshis, priority).pipe(
      switchMap((prepared) => {
        if (!prepared) {
          return of({ success: false, error: 'Insufficient funds' });
        }

        try {
          const txHex = this.signTransaction(prepared);
          return this.broadcastTransaction(txHex);
        } catch (error) {
          return of({
            success: false,
            error: error instanceof Error ? error.message : 'Transaction signing failed',
          });
        }
      })
    );
  }

  #getFeeRateForPriority(estimates: FeeEstimates, priority: FeePriority): number {
    switch (priority) {
      case 'fastest':
        return estimates.fastestFee;
      case 'halfHour':
        return estimates.halfHourFee;
      case 'hour':
        return estimates.hourFee;
      case 'economy':
        return estimates.economyFee;
    }
  }
}
