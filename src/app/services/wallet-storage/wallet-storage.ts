import { Injectable, signal } from '@angular/core';
import { AddressBalance, UTXO, WalletTransaction } from '../../interfaces';

const DB_NAME = 'crypto-wallet-db';
const DB_VERSION = 1;
const STORE_NAME = 'wallet-state';

/**
 * Wallet state to be persisted.
 */
export interface PersistedWalletState {
  walletId: string; // Hash of mnemonic to identify wallet without storing it
  highestUsedReceiveIndex: number;
  highestUsedChangeIndex: number;
  usedAddresses: AddressBalance[];
  utxos: UTXO[];
  transactions: WalletTransaction[];
  lastUpdated: number;
}

@Injectable({
  providedIn: 'root',
})
export class WalletStorageService {
  readonly #db = signal<IDBDatabase | null>(null);
  readonly #isReady = signal(false);

  readonly isReady = this.#isReady.asReadonly();

  constructor() {
    this.#initDatabase();
  }

  /**
   * Initialize the IndexedDB database.
   */
  #initDatabase(): void {
    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB not available');
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
    };

    request.onsuccess = () => {
      this.#db.set(request.result);
      this.#isReady.set(true);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'walletId' });
      }
    };
  }

  /**
   * Generate a wallet ID from a mnemonic without storing the mnemonic.
   * Uses a simple hash for identification.
   */
  async getWalletId(mnemonic: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(mnemonic);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Save wallet state to IndexedDB.
   */
  async saveState(
    mnemonic: string,
    state: Omit<PersistedWalletState, 'walletId' | 'lastUpdated'>
  ): Promise<void> {
    const db = this.#db();
    if (!db) {
      console.warn('Database not ready');
      return;
    }

    const walletId = await this.getWalletId(mnemonic);

    const persistedState: PersistedWalletState = {
      ...state,
      walletId,
      lastUpdated: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(persistedState);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load wallet state from IndexedDB.
   */
  async loadState(mnemonic: string): Promise<PersistedWalletState | null> {
    const db = this.#db();
    if (!db) {
      console.warn('Database not ready');
      return null;
    }

    const walletId = await this.getWalletId(mnemonic);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(walletId);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete wallet state from IndexedDB.
   */
  async deleteState(mnemonic: string): Promise<void> {
    const db = this.#db();
    if (!db) {
      console.warn('Database not ready');
      return;
    }

    const walletId = await this.getWalletId(mnemonic);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(walletId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all stored wallet states.
   */
  async clearAll(): Promise<void> {
    const db = this.#db();
    if (!db) {
      console.warn('Database not ready');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if a wallet has persisted state.
   */
  async hasState(mnemonic: string): Promise<boolean> {
    const state = await this.loadState(mnemonic);
    return state !== null;
  }
}
