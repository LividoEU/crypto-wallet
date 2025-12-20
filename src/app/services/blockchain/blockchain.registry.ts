import { inject, Injectable } from '@angular/core';
import { BlockchainService } from '../../interfaces';
import { BitcoinService } from '../bitcoin/bitcoin';
import {
  BlockchainType,
  NetworkType,
  BaseWalletInfo,
  BLOCKCHAIN_INFO,
} from '../../models';

/**
 * Central registry for all blockchain implementations.
 * Manages access to different blockchain services and provides
 * a unified API for wallet operations across all supported chains.
 *
 * To add a new blockchain:
 * 1. Create a service implementing BlockchainService interface
 * 2. Register it in this registry's constructor
 * 3. Add its types to the models
 */
@Injectable({
  providedIn: 'root',
})
export class BlockchainRegistry {
  #services = new Map<BlockchainType, BlockchainService>();

  // Inject all blockchain services
  #bitcoinService = inject(BitcoinService);
  // #ethereumService = inject(EthereumService);  // Future
  // #solanaService = inject(SolanaService);      // Future

  constructor() {
    this.registerServices();
  }

  /**
   * Register all available blockchain services.
   * Add new services here as they are implemented.
   */
  private registerServices(): void {
    this.register(this.#bitcoinService);
    // this.register(this.#ethereumService);  // Future
    // this.register(this.#solanaService);    // Future
  }

  /**
   * Register a blockchain service in the registry.
   */
  private register(service: BlockchainService): void {
    this.#services.set(service.blockchainType, service);
  }

  /**
   * Get a blockchain service by type.
   * @throws Error if the blockchain is not supported
   */
  get<T extends BlockchainService>(blockchain: BlockchainType): T {
    const service = this.#services.get(blockchain);
    if (!service) {
      throw new Error(`Blockchain "${blockchain}" is not supported`);
    }
    return service as T;
  }

  /**
   * Check if a blockchain type is supported.
   */
  isSupported(blockchain: BlockchainType): boolean {
    return this.#services.has(blockchain);
  }

  /**
   * Get all registered blockchain types.
   */
  getRegisteredBlockchains(): BlockchainType[] {
    return Array.from(this.#services.keys());
  }

  /**
   * Get supported networks for a blockchain.
   */
  getSupportedNetworks(blockchain: BlockchainType): readonly NetworkType[] {
    const service = this.get(blockchain);
    return service.supportedNetworks;
  }

  /**
   * Get blockchain metadata/info.
   */
  getBlockchainInfo(blockchain: BlockchainType) {
    return BLOCKCHAIN_INFO[blockchain];
  }

  /**
   * Create a wallet for any supported blockchain.
   */
  createWallet(blockchain: BlockchainType, network: NetworkType): BaseWalletInfo {
    const service = this.get(blockchain);
    return service.createWallet(network);
  }

  /**
   * Validate an address for any supported blockchain.
   */
  validateAddress(
    blockchain: BlockchainType,
    address: string,
    network?: NetworkType
  ): boolean {
    const service = this.get(blockchain);
    return service.validateAddress(address, network);
  }

  /**
   * Validate a mnemonic phrase.
   */
  validateMnemonic(blockchain: BlockchainType, mnemonic: string): boolean {
    const service = this.get(blockchain);
    return service.validateMnemonic(mnemonic);
  }
}
