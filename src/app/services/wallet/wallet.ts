import { inject, Injectable } from '@angular/core';
import { BlockchainRegistry } from '../blockchain';
import { BlockchainType, NetworkType, BaseWalletInfo, BLOCKCHAIN_INFO } from '../../models';

/**
 * Unified wallet service that acts as a facade for all blockchain operations.
 * Provides a single entry point for creating and managing wallets across
 * all supported cryptocurrencies.
 */
@Injectable({
  providedIn: 'root',
})
export class WalletService {
  #registry = inject(BlockchainRegistry);

  /**
   * Create a wallet for any supported blockchain.
   * Logs the wallet details to the console.
   */
  createWallet(blockchain: BlockchainType, network: NetworkType): BaseWalletInfo {
    const wallet = this.#registry.createWallet(blockchain, network);
    this.logWalletCreation(wallet);
    return wallet;
  }

  /**
   * Get all supported blockchains.
   */
  getSupportedBlockchains(): BlockchainType[] {
    return this.#registry.getRegisteredBlockchains();
  }

  /**
   * Get supported networks for a blockchain.
   */
  getSupportedNetworks(blockchain: BlockchainType): readonly NetworkType[] {
    return this.#registry.getSupportedNetworks(blockchain);
  }

  /**
   * Validate an address for a specific blockchain.
   */
  validateAddress(blockchain: BlockchainType, address: string, network?: NetworkType): boolean {
    return this.#registry.validateAddress(blockchain, address, network);
  }

  /**
   * Validate a mnemonic phrase.
   */
  validateMnemonic(blockchain: BlockchainType, mnemonic: string): boolean {
    return this.#registry.validateMnemonic(blockchain, mnemonic);
  }

  /**
   * Log wallet creation details to the console.
   */
  private logWalletCreation(wallet: BaseWalletInfo): void {
    const info = BLOCKCHAIN_INFO[wallet.blockchain];
    const header = `${info.name} (${info.symbol}) Wallet Created`;

    console.group(header);
    console.log('Blockchain:', wallet.blockchain);
    console.log('Network:', wallet.network);
    console.log('Mnemonic:', wallet.mnemonic);
    console.log('Derivation Path:', wallet.derivationPath);
    console.log('Private Key (hex):', wallet.privateKey);
    console.log('Public Key (hex):', wallet.publicKey);
    console.log('Address:', wallet.address);
    console.log('Created At:', wallet.createdAt.toISOString());

    // Log blockchain-specific fields
    this.logBlockchainSpecificFields(wallet);

    console.groupEnd();
  }

  /**
   * Log blockchain-specific fields based on wallet type.
   */
  private logBlockchainSpecificFields(wallet: BaseWalletInfo): void {
    if ('addressType' in wallet) {
      console.log('Address Type:', wallet.addressType);
    }
    if ('checksumAddress' in wallet) {
      console.log('Checksum Address:', wallet.checksumAddress);
    }
  }
}
