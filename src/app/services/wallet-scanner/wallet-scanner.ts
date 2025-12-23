import { inject, Injectable } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, expand, takeWhile, reduce, switchMap } from 'rxjs/operators';
import { BitcoinService } from '../bitcoin';
import { BlockchainApiService } from '../blockchain-api';
import { BlockchainTransaction } from '../../models/blockchain-api.types';
import { AddressBranch, AddressBalance, UTXO, WalletTransaction, WalletScanResult } from '../../interfaces';

const GAP_LIMIT = 20;
const BATCH_SIZE = 10;

interface ScanState {
  currentIndex: number;
  consecutiveUnused: number;
  usedAddresses: AddressBalance[];
  done: boolean;
}

interface BranchScanResult {
  usedAddresses: AddressBalance[];
  highestUsedIndex: number;
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
   * Scans both receive (/0/*) and change (/1/*) branches.
   * @param mnemonic The wallet mnemonic
   * @param network The Bitcoin network
   * @returns Observable with scan results including used addresses, UTXOs, and total balance
   */
  scanWallet(mnemonic: string, network: 'mainnet' | 'testnet' = 'mainnet'): Observable<WalletScanResult> {
    // Scan both branches in parallel
    return forkJoin({
      receive: this.#scanBranch(mnemonic, network, 'receive'),
      change: this.#scanBranch(mnemonic, network, 'change'),
    }).pipe(
      switchMap(({ receive, change }) => {
        const allAddresses = [...receive.usedAddresses, ...change.usedAddresses];

        if (allAddresses.length === 0) {
          return of({
            usedAddresses: [],
            transactions: [],
            utxos: [],
            totalBalanceSatoshis: 0,
            highestUsedReceiveIndex: -1,
            highestUsedChangeIndex: -1,
          });
        }

        // Fetch transactions and UTXOs for all used addresses
        const addressStrings = allAddresses.map((a) => a.address);
        return forkJoin({
          transactions: this.#fetchTransactions(addressStrings),
          utxos: this.#fetchUtxos(allAddresses),
        }).pipe(
          map(({ transactions, utxos }) => ({
            usedAddresses: allAddresses,
            transactions,
            utxos,
            totalBalanceSatoshis: allAddresses.reduce(
              (sum, addr) => sum + addr.balanceSatoshis,
              0
            ),
            highestUsedReceiveIndex: receive.highestUsedIndex,
            highestUsedChangeIndex: change.highestUsedIndex,
          }))
        );
      })
    );
  }

  /**
   * Scan a single branch (receive or change) for used addresses.
   */
  #scanBranch(
    mnemonic: string,
    network: 'mainnet' | 'testnet',
    branch: AddressBranch
  ): Observable<BranchScanResult> {
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
        return this.#scanBatch(mnemonic, state.currentIndex, network, branch).pipe(
          map((batchResult) => this.#processBatchResult(state, batchResult))
        );
      }),
      takeWhile((state) => !state.done, true),
      reduce((_, state) => state),
      map((finalState) => ({
        usedAddresses: finalState.usedAddresses,
        highestUsedIndex:
          finalState.usedAddresses.length > 0
            ? Math.max(...finalState.usedAddresses.map((a) => a.index))
            : -1,
      }))
    );
  }

  #fetchTransactions(addresses: string[]): Observable<WalletTransaction[]> {
    if (addresses.length === 0) {
      return of([]);
    }
    return this.#blockchainApi.getMultiAddressInfo(addresses, 50, 0).pipe(
      map((response) => this.#mapTransactions(response.txs)),
      catchError(() => of([]))
    );
  }

  #fetchUtxos(addresses: AddressBalance[]): Observable<UTXO[]> {
    if (addresses.length === 0) {
      return of([]);
    }

    // Create a map of address to derivation path for quick lookup
    const addressToPath = new Map<string, { path: string; branch: AddressBranch }>();
    for (const addr of addresses) {
      addressToPath.set(addr.address, { path: addr.derivationPath, branch: addr.branch });
    }

    // Fetch UTXOs for all addresses
    const addressStrings = addresses.map((a) => a.address);
    const requests = addressStrings.map((address) =>
      this.#blockchainApi.getUnspentOutputs(address).pipe(
        map((response) =>
          response.unspent_outputs.map((utxo) => {
            const addrInfo = addressToPath.get(address);
            return {
              txHash: utxo.tx_hash_big_endian,
              outputIndex: utxo.tx_output_n,
              value: utxo.value,
              scriptPubKey: utxo.script,
              address,
              derivationPath: addrInfo?.path ?? '',
              confirmations: utxo.confirmations,
            } satisfies UTXO;
          })
        ),
        catchError(() => of([] as UTXO[]))
      )
    );

    return forkJoin(requests).pipe(map((results) => results.flat()));
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
    network: 'mainnet' | 'testnet',
    branch: AddressBranch
  ): Observable<AddressBalance[]> {
    const derivedAddresses = this.#bitcoinService.deriveAddresses(
      mnemonic,
      startIndex,
      BATCH_SIZE,
      network,
      branch
    );

    const addressStrings = derivedAddresses.map((a) => a.address);

    return this.#checkAddressesBalance(addressStrings).pipe(
      map((balances) =>
        derivedAddresses.map((derived, i) => ({
          address: derived.address,
          derivationPath: derived.derivationPath,
          index: derived.index,
          branch: derived.branch,
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
