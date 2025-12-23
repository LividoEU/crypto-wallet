import { inject, Injectable } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, expand, takeWhile, reduce, switchMap } from 'rxjs/operators';
import { BitcoinService } from '../bitcoin';
import { BlockchainApiService } from '../blockchain-api';
import { BlockchainTransaction } from '../../models/blockchain-api.types';
import { AddressBalance, WalletTransaction, WalletScanResult } from '../../interfaces';

const GAP_LIMIT = 20;
const BATCH_SIZE = 10;

interface ScanState {
  currentIndex: number;
  consecutiveUnused: number;
  usedAddresses: AddressBalance[];
  done: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class WalletScannerService {
  readonly #bitcoinService = inject(BitcoinService);
  readonly #blockchainApi = inject(BlockchainApiService);

  /**
   * Scan a wallet for all used addresses and calculate total balance.
   * Implements BIP44 gap limit: stops after finding 20 consecutive unused addresses.
   * @param mnemonic The wallet mnemonic
   * @param network The Bitcoin network
   * @returns Observable with scan results including used addresses and total balance
   */
  scanWallet(mnemonic: string, network: 'mainnet' | 'testnet' = 'mainnet'): Observable<WalletScanResult> {
    const initialState: ScanState = {
      currentIndex: 0,
      consecutiveUnused: 0,
      usedAddresses: [],
      done: false,
    };

    return of(initialState).pipe(
      expand((state) => {
        if (state.done) {
          return of({ ...state, done: true });
        }
        return this.#scanBatch(mnemonic, state.currentIndex, network).pipe(
          map((batchResult) => this.#processBatchResult(state, batchResult))
        );
      }),
      takeWhile((state) => !state.done, true),
      reduce((_, state) => state),
      switchMap((finalState) => {
        const usedAddresses = finalState.usedAddresses;
        if (usedAddresses.length === 0) {
          return of({
            usedAddresses,
            transactions: [],
            totalBalanceSatoshis: 0,
            highestUsedIndex: -1,
          });
        }

        // Fetch transactions for all used addresses
        return this.#fetchTransactions(usedAddresses.map((a) => a.address)).pipe(
          map((transactions) => ({
            usedAddresses,
            transactions,
            totalBalanceSatoshis: usedAddresses.reduce(
              (sum, addr) => sum + addr.balanceSatoshis,
              0
            ),
            highestUsedIndex: Math.max(...usedAddresses.map((a) => a.index)),
          }))
        );
      })
    );
  }

  #fetchTransactions(addresses: string[]): Observable<WalletTransaction[]> {
    return this.#blockchainApi.getMultiAddressInfo(addresses, 50, 0).pipe(
      map((response) => this.#mapTransactions(response.txs)),
      catchError(() => of([]))
    );
  }

  #mapTransactions(txs: readonly BlockchainTransaction[]): WalletTransaction[] {
    return txs.map((tx) => ({
      hash: tx.hash,
      time: tx.time,
      blockHeight: tx.block_height,
      fee: tx.fee,
      inputs: tx.inputs.map((input) => ({
        address: input.prev_out?.addr,
        value: input.prev_out?.value ?? 0,
      })),
      outputs: tx.out.map((output) => ({
        address: output.addr,
        value: output.value,
      })),
      result: tx.result,
    }));
  }

  #scanBatch(
    mnemonic: string,
    startIndex: number,
    network: 'mainnet' | 'testnet'
  ): Observable<AddressBalance[]> {
    const derivedAddresses = this.#bitcoinService.deriveAddresses(
      mnemonic,
      startIndex,
      BATCH_SIZE,
      network
    );

    const addressStrings = derivedAddresses.map((a) => a.address);

    return this.#checkAddressesBalance(addressStrings).pipe(
      map((balances) =>
        derivedAddresses.map((derived, i) => ({
          address: derived.address,
          derivationPath: derived.derivationPath,
          index: derived.index,
          balanceSatoshis: balances[i]?.balance ?? 0,
          transactionCount: balances[i]?.txCount ?? 0,
        }))
      )
    );
  }

  #checkAddressesBalance(
    addresses: string[]
  ): Observable<{ balance: number; txCount: number }[]> {
    if (addresses.length === 0) {
      return of([]);
    }

    // Use multiaddr endpoint for efficiency
    return this.#blockchainApi.getMultiAddressInfo(addresses, 0, 0).pipe(
      map((response) => {
        const balanceMap = new Map<string, { balance: number; txCount: number }>();

        for (const addrInfo of response.addresses) {
          balanceMap.set(addrInfo.address, {
            balance: addrInfo.final_balance,
            txCount: addrInfo.n_tx,
          });
        }

        return addresses.map((addr) => balanceMap.get(addr) ?? { balance: 0, txCount: 0 });
      }),
      catchError(() => {
        // If multiaddr fails, fall back to individual requests
        return this.#checkAddressesIndividually(addresses);
      })
    );
  }

  #checkAddressesIndividually(
    addresses: string[]
  ): Observable<{ balance: number; txCount: number }[]> {
    const requests = addresses.map((address) =>
      this.#blockchainApi.getBalance(address).pipe(
        map((response) => {
          const data = response[address];
          return {
            balance: data?.final_balance ?? 0,
            txCount: data?.n_tx ?? 0,
          };
        }),
        catchError(() => of({ balance: 0, txCount: 0 }))
      )
    );

    return forkJoin(requests);
  }

  #processBatchResult(state: ScanState, batchResults: AddressBalance[]): ScanState {
    let consecutiveUnused = state.consecutiveUnused;
    const usedAddresses = [...state.usedAddresses];

    for (const result of batchResults) {
      if (result.transactionCount > 0) {
        usedAddresses.push(result);
        consecutiveUnused = 0;
      } else {
        consecutiveUnused++;
      }

      if (consecutiveUnused >= GAP_LIMIT) {
        return {
          currentIndex: result.index + 1,
          consecutiveUnused,
          usedAddresses,
          done: true,
        };
      }
    }

    return {
      currentIndex: state.currentIndex + BATCH_SIZE,
      consecutiveUnused,
      usedAddresses,
      done: false,
    };
  }
}
