/**
 * Represents a derived address from an HD wallet.
 */
export interface DerivedAddress {
  address: string;
  derivationPath: string;
  index: number;
}

/**
 * Balance information for a specific address.
 */
export interface AddressBalance {
  address: string;
  derivationPath: string;
  index: number;
  balanceSatoshis: number;
  transactionCount: number;
}

/**
 * Transaction information for a wallet.
 */
export interface WalletTransaction {
  hash: string;
  time: number;
  blockHeight?: number;
  fee: number;
  inputs: { address?: string; value: number }[];
  outputs: { address?: string; value: number }[];
  result: number;
}

/**
 * Result of scanning a wallet for addresses and transactions.
 */
export interface WalletScanResult {
  usedAddresses: AddressBalance[];
  transactions: WalletTransaction[];
  totalBalanceSatoshis: number;
  highestUsedIndex: number;
}

/**
 * Complete state of the wallet session.
 */
export interface WalletState {
  mnemonic: string;
  balanceSatoshis: number;
  usedAddresses: AddressBalance[];
  transactions: WalletTransaction[];
  eurPrice: number | null;
  isScanning: boolean;
  scanError: string | null;
}
