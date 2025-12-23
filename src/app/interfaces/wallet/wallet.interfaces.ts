/**
 * Address type for BIP84 HD wallet branches.
 */
export type AddressBranch = 'receive' | 'change';

/**
 * Represents a derived address from an HD wallet.
 */
export interface DerivedAddress {
  address: string;
  derivationPath: string;
  index: number;
  branch: AddressBranch;
}

/**
 * Unspent Transaction Output (UTXO) for spending.
 */
export interface UTXO {
  txHash: string;
  outputIndex: number;
  value: number;
  scriptPubKey: string;
  address: string;
  derivationPath: string;
  confirmations: number;
}

/**
 * Balance information for a specific address.
 */
export interface AddressBalance {
  address: string;
  derivationPath: string;
  index: number;
  branch: AddressBranch;
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
  utxos: UTXO[];
  totalBalanceSatoshis: number;
  highestUsedReceiveIndex: number;
  highestUsedChangeIndex: number;
}

/**
 * Complete state of the wallet session.
 */
export interface WalletState {
  mnemonic: string;
  balanceSatoshis: number;
  usedAddresses: AddressBalance[];
  transactions: WalletTransaction[];
  utxos: UTXO[];
  eurPrice: number | null;
  isScanning: boolean;
  scanError: string | null;
  highestUsedReceiveIndex: number;
  highestUsedChangeIndex: number;
}
