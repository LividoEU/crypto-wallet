import { computed, inject, Injectable, signal } from '@angular/core';
import { WalletScannerService } from '../wallet-scanner';
import { BlockchainApiService } from '../blockchain-api';
import { BitcoinService } from '../bitcoin';
import { AddressBalance, DerivedAddress, WalletScanResult, WalletTransaction } from '../../interfaces';

@Injectable({
  providedIn: 'root',
})
export class WalletSessionService {
  readonly #walletScanner = inject(WalletScannerService);
  readonly #blockchainApi = inject(BlockchainApiService);
  readonly #bitcoinService = inject(BitcoinService);

  readonly #mnemonic = signal<string | null>(null);
  readonly #isLoggedIn = signal(false);
  readonly #balanceSatoshis = signal(0);
  readonly #usedAddresses = signal<AddressBalance[]>([]);
  readonly #transactions = signal<WalletTransaction[]>([]);
  readonly #eurPrice = signal<number | null>(null);
  readonly #isScanning = signal(false);
  readonly #scanError = signal<string | null>(null);
  readonly #highestUsedIndex = signal(-1);

  readonly mnemonic = this.#mnemonic.asReadonly();
  readonly isLoggedIn = this.#isLoggedIn.asReadonly();
  readonly balanceSatoshis = this.#balanceSatoshis.asReadonly();
  readonly usedAddresses = this.#usedAddresses.asReadonly();
  readonly transactions = this.#transactions.asReadonly();
  readonly eurPrice = this.#eurPrice.asReadonly();
  readonly isScanning = this.#isScanning.asReadonly();
  readonly scanError = this.#scanError.asReadonly();
  readonly highestUsedIndex = this.#highestUsedIndex.asReadonly();

  login(mnemonic: string): void {
    this.#mnemonic.set(mnemonic);
    this.#isLoggedIn.set(true);
    this.#isScanning.set(true);
    this.#scanError.set(null);

    // Fetch EUR price
    this.#fetchEurPrice();

    // Scan wallet for addresses, balances, and transactions
    this.#walletScanner.scanWallet(mnemonic, 'mainnet').subscribe({
      next: (result: WalletScanResult) => {
        this.#balanceSatoshis.set(result.totalBalanceSatoshis);
        this.#usedAddresses.set(result.usedAddresses);
        this.#transactions.set(result.transactions);
        this.#highestUsedIndex.set(result.highestUsedIndex);
        this.#isScanning.set(false);
      },
      error: (err) => {
        console.error('Wallet scan failed:', err);
        this.#scanError.set('Failed to scan wallet');
        this.#isScanning.set(false);
      },
    });
  }

  logout(): void {
    this.#mnemonic.set(null);
    this.#isLoggedIn.set(false);
    this.#balanceSatoshis.set(0);
    this.#usedAddresses.set([]);
    this.#transactions.set([]);
    this.#eurPrice.set(null);
    this.#isScanning.set(false);
    this.#scanError.set(null);
    this.#highestUsedIndex.set(-1);
  }

  refreshBalance(): void {
    const mnemonic = this.#mnemonic();
    if (!mnemonic) return;

    this.#isScanning.set(true);
    this.#scanError.set(null);
    this.#fetchEurPrice();

    this.#walletScanner.scanWallet(mnemonic, 'mainnet').subscribe({
      next: (result: WalletScanResult) => {
        this.#balanceSatoshis.set(result.totalBalanceSatoshis);
        this.#usedAddresses.set(result.usedAddresses);
        this.#transactions.set(result.transactions);
        this.#highestUsedIndex.set(result.highestUsedIndex);
        this.#isScanning.set(false);
      },
      error: (err) => {
        console.error('Wallet scan failed:', err);
        this.#scanError.set('Failed to refresh balance');
        this.#isScanning.set(false);
      },
    });
  }

  /**
   * Get the first unused address from the wallet.
   * This derives the next address after the highest used index.
   * @returns The first unused address or null if not logged in
   */
  getFirstUnusedAddress(): DerivedAddress | null {
    const mnemonic = this.#mnemonic();
    if (!mnemonic) return null;

    const nextIndex = this.#highestUsedIndex() + 1;
    return this.#bitcoinService.deriveAddressAtIndex(mnemonic, nextIndex, 'mainnet');
  }

  #fetchEurPrice(): void {
    this.#blockchainApi.getTicker().subscribe({
      next: (ticker) => {
        this.#eurPrice.set(ticker['EUR']?.last ?? null);
      },
      error: () => {
        this.#eurPrice.set(null);
      },
    });
  }

  /**
   * Convert satoshis to BTC
   */
  satoshisToBtc(satoshis: number): number {
    return satoshis / 100_000_000;
  }

  /**
   * Convert satoshis to EUR using current price
   */
  satoshisToEur(satoshis: number): number | null {
    const price = this.#eurPrice();
    if (price === null) return null;
    return this.satoshisToBtc(satoshis) * price;
  }
}
