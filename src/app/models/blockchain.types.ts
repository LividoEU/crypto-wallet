/**
 * Supported blockchain types in the application.
 * Add new blockchain identifiers here when expanding support.
 */
export type BlockchainType = 'bitcoin' | 'ethereum' | 'solana';

/**
 * Network types available across different blockchains.
 * Most blockchains support mainnet and testnet at minimum.
 */
export type NetworkType = 'mainnet' | 'testnet' | 'devnet';

/**
 * Blockchain-specific network configurations.
 * Maps each blockchain to its supported networks.
 */
export interface BlockchainNetworks {
  bitcoin: 'mainnet' | 'testnet';
  ethereum: 'mainnet' | 'testnet' | 'devnet';
  solana: 'mainnet' | 'testnet' | 'devnet';
}

/**
 * Blockchain metadata for display and configuration purposes.
 */
export interface BlockchainInfo {
  readonly type: BlockchainType;
  readonly name: string;
  readonly symbol: string;
  readonly networks: readonly NetworkType[];
}

/**
 * Registry of all supported blockchains with their metadata.
 */
export const BLOCKCHAIN_INFO: Record<BlockchainType, BlockchainInfo> = {
  bitcoin: {
    type: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC',
    networks: ['mainnet', 'testnet'],
  },
  ethereum: {
    type: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    networks: ['mainnet', 'testnet', 'devnet'],
  },
  solana: {
    type: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    networks: ['mainnet', 'testnet', 'devnet'],
  },
} as const;
