import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { WalletScannerService } from '../wallet-scanner';
import { BlockchainApiService } from '../blockchain-api';
import { BitcoinService } from '../bitcoin';
import { WalletStorageService } from '../wallet-storage';
import { AddressBalance, DerivedAddress, UTXO, WalletScanResult, WalletTransaction } from '../../interfaces';

@Injectable({
  providedIn: 'root',
})
export class WalletSessionService {
  readonly #walletScanner = inject(WalletScannerService);
  readonly #blockchainApi = inject(BlockchainApiService);
  readonly #bitcoinService = inject(BitcoinService);
  readonly #storage = inject(WalletStorageService);

  readonly #mnemonic = signal<string | null>(null);
  readonly #isLoggedIn = signal(false);
  readonly #balanceSatoshis = signal(0);
  readonly #usedAddresses = signal<AddressBalance[]>([]);
  readonly #transactions = signal<WalletTransaction[]>([]);
  readonly #utxos = signal<UTXO[]>([]);
  readonly #eurPrice = signal<number | null>(null);
  readonly #isScanning = signal(false);
  readonly #scanError = signal<string | null>(null);
  readonly #highestUsedReceiveIndex = signal(-1);
  readonly #highestUsedChangeIndex = signal(-1);

  readonly mnemonic = this.#mnemonic.asReadonly();
  readonly isLoggedIn = this.#isLoggedIn.asReadonly();
  readonly balanceSatoshis = this.#balanceSatoshis.asReadonly();
  readonly usedAddresses = this.#usedAddresses.asReadonly();
  readonly transactions = this.#transactions.asReadonly();
  readonly utxos = this.#utxos.asReadonly();
  readonly eurPrice = this.#eurPrice.asReadonly();
  readonly isScanning = this.#isScanning.asReadonly();
  readonly scanError = this.#scanError.asReadonly();
  readonly highestUsedReceiveIndex = this.#highestUsedReceiveIndex.asReadonly();
  readonly highestUsedChangeIndex = this.#highestUsedChangeIndex.asReadonly();

  // Computed: Only receive addresses (for display purposes)
  readonly receiveAddresses = computed(() =>
    this.#usedAddresses().filter((a) => a.branch === 'receive')
  );

  // Computed: Only change addresses
  readonly changeAddresses = computed(() =>
    this.#usedAddresses().filter((a) => a.branch === 'change')
  );

  // Computed: Spendable balance (sum of confirmed UTXOs)
  readonly spendableBalanceSatoshis = computed(() =>
    this.#utxos()
      .filter((utxo) => utxo.confirmations > 0)
      .reduce((sum, utxo) => sum + utxo.value, 0)
  );

  constructor() {
    // Auto-save state when wallet data changes
    effect(() => {
      const mnemonic = this.#mnemonic();
      const usedAddresses = this.#usedAddresses();
      const transactions = this.#transactions();
      const utxos = this.#utxos();
      const highestReceive = this.#highestUsedReceiveIndex();
      const highestChange = this.#highestUsedChangeIndex();

      if (mnemonic && usedAddresses.length > 0) {
        this.#storage.saveState(mnemonic, {
          highestUsedReceiveIndex: highestReceive,
          highestUsedChangeIndex: highestChange,
          usedAddresses,
          utxos,
          transactions,
        });
      }
    });
  }

  async login(mnemonic: string): Promise<void> {
    this.#mnemonic.set(mnemonic);
    this.#isLoggedIn.set(true);
    this.#isScanning.set(true);
    this.#scanError.set(null);

    // Fetch EUR price
    this.#fetchEurPrice();

    // Try to load cached state first for faster initial display
    try {
      const cachedState = await this.#storage.loadState(mnemonic);
      if (cachedState) {
        this.#usedAddresses.set(cachedState.usedAddresses);
        this.#transactions.set(cachedState.transactions);
        this.#utxos.set(cachedState.utxos);
        this.#highestUsedReceiveIndex.set(cachedState.highestUsedReceiveIndex);
        this.#highestUsedChangeIndex.set(cachedState.highestUsedChangeIndex);
        this.#balanceSatoshis.set(
          cachedState.usedAddresses.reduce((sum, addr) => sum + addr.balanceSatoshis, 0)
        );
      }
    } catch (err) {
      console.warn('Failed to load cached state:', err);
    }

    // Scan wallet for fresh data (will update the cached state)
    this.#walletScanner.scanWallet(mnemonic, 'mainnet').subscribe({
      next: (result: WalletScanResult) => {
        this.#balanceSatoshis.set(result.totalBalanceSatoshis);
        this.#usedAddresses.set(result.usedAddresses);
        this.#transactions.set(result.transactions);
        this.#utxos.set(result.utxos);
        this.#highestUsedReceiveIndex.set(result.highestUsedReceiveIndex);
        this.#highestUsedChangeIndex.set(result.highestUsedChangeIndex);
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
    this.#utxos.set([]);
    this.#eurPrice.set(null);
    this.#isScanning.set(false);
    this.#scanError.set(null);
    this.#highestUsedReceiveIndex.set(-1);
    this.#highestUsedChangeIndex.set(-1);
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
        this.#utxos.set(result.utxos);
        this.#highestUsedReceiveIndex.set(result.highestUsedReceiveIndex);
        this.#highestUsedChangeIndex.set(result.highestUsedChangeIndex);
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
   * Get the first unused receive address from the wallet.
   * This derives the next address after the highest used receive index.
   * @returns The first unused receive address or null if not logged in
   */
  getFirstUnusedAddress(): DerivedAddress | null {
    const mnemonic = this.#mnemonic();
    if (!mnemonic) return null;

    const nextIndex = this.#highestUsedReceiveIndex() + 1;
    return this.#bitcoinService.deriveAddressAtIndex(mnemonic, nextIndex, 'mainnet', 'receive');
  }

  /**
   * Get the next unused change address.
   * @returns The next change address or null if not logged in
   */
  getNextChangeAddress(): DerivedAddress | null {
    const mnemonic = this.#mnemonic();
    if (!mnemonic) return null;

    const nextIndex = this.#highestUsedChangeIndex() + 1;
    return this.#bitcoinService.deriveAddressAtIndex(mnemonic, nextIndex, 'mainnet', 'change');
  }

  /**
   * Get UTXOs that can be spent (confirmed).
   */
  getSpendableUtxos(): UTXO[] {
    return this.#utxos().filter((utxo) => utxo.confirmations > 0);
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
