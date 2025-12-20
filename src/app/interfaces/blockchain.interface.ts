import { InjectionToken } from '@angular/core';
import {
  BlockchainType,
  NetworkType,
  BaseWalletInfo,
  WalletCreationOptions,
} from '../models';

/**
 * Base interface that all blockchain implementations must follow.
 * This ensures consistency across Bitcoin, Ethereum, Solana, etc.
 */
export interface BlockchainService<
  TNetwork extends NetworkType = NetworkType,
  TWallet extends BaseWalletInfo = BaseWalletInfo,
> {
  /**
   * The blockchain type this service handles.
   */
  readonly blockchainType: BlockchainType;

  /**
   * List of networks supported by this blockchain.
   */
  readonly supportedNetworks: readonly TNetwork[];

  /**
   * Creates a new wallet for the specified network.
   * @param network The target network (mainnet, testnet, etc.)
   * @param options Optional wallet creation configuration
   * @returns The created wallet information
   */
  createWallet(network: TNetwork, options?: WalletCreationOptions): TWallet;

  /**
   * Validates if the given address is valid for this blockchain.
   * @param address The address to validate
   * @param network Optional network for network-specific validation
   * @returns True if the address is valid
   */
  validateAddress(address: string, network?: TNetwork): boolean;

  /**
   * Validates if the given mnemonic phrase is valid.
   * @param mnemonic The mnemonic phrase to validate
   * @returns True if the mnemonic is valid
   */
  validateMnemonic(mnemonic: string): boolean;
}

/**
 * Injection token for blockchain services.
 * Used for registering multiple blockchain implementations.
 */
export const BLOCKCHAIN_SERVICE = new InjectionToken<BlockchainService>(
  'BLOCKCHAIN_SERVICE'
);
