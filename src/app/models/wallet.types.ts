import { BlockchainType, NetworkType } from './blockchain.types';

/**
 * Base wallet information common to all blockchain types.
 * All blockchain-specific wallet implementations should extend this.
 */
export interface BaseWalletInfo {
  readonly blockchain: BlockchainType;
  readonly network: NetworkType;
  readonly mnemonic: string;
  readonly derivationPath: string;
  readonly privateKey: string;
  readonly publicKey: string;
  readonly address: string;
  readonly createdAt: Date;
}

/**
 * Bitcoin-specific wallet information.
 */
export interface BitcoinWalletInfo extends BaseWalletInfo {
  readonly blockchain: 'bitcoin';
  readonly network: 'mainnet' | 'testnet';
  readonly addressType: 'p2wpkh' | 'p2pkh' | 'p2sh';
}

/**
 * Ethereum-specific wallet information.
 * Prepared for future implementation.
 */
export interface EthereumWalletInfo extends BaseWalletInfo {
  readonly blockchain: 'ethereum';
  readonly network: 'mainnet' | 'testnet' | 'devnet';
  readonly checksumAddress: string;
}

/**
 * Solana-specific wallet information.
 * Prepared for future implementation.
 */
export interface SolanaWalletInfo extends BaseWalletInfo {
  readonly blockchain: 'solana';
  readonly network: 'mainnet' | 'testnet' | 'devnet';
}

/**
 * Union type of all wallet info types.
 * Use this when handling wallets of any blockchain type.
 */
export type WalletInfo = BitcoinWalletInfo | EthereumWalletInfo | SolanaWalletInfo;

/**
 * Configuration options for wallet creation.
 */
export interface WalletCreationOptions {
  readonly entropyBits?: 128 | 256;
  readonly addressType?: string;
}
