/**
 * Types for blockchain.com API responses.
 * @see https://www.blockchain.com/es/explorer/api
 */

/**
 * Transaction input from blockchain.com API.
 */
export interface BlockchainInput {
  readonly sequence: number;
  readonly witness: string;
  readonly script: string;
  readonly index: number;
  readonly prev_out?: {
    readonly spent: boolean;
    readonly tx_index: number;
    readonly type: number;
    readonly addr?: string;
    readonly value: number;
    readonly n: number;
    readonly script: string;
  };
}

/**
 * Transaction output from blockchain.com API.
 */
export interface BlockchainOutput {
  readonly type: number;
  readonly spent: boolean;
  readonly value: number;
  readonly spending_outpoints: readonly {
    readonly tx_index: number;
    readonly n: number;
  }[];
  readonly n: number;
  readonly tx_index: number;
  readonly script: string;
  readonly addr?: string;
}

/**
 * Transaction from blockchain.com API.
 */
export interface BlockchainTransaction {
  readonly hash: string;
  readonly ver: number;
  readonly vin_sz: number;
  readonly vout_sz: number;
  readonly size: number;
  readonly weight: number;
  readonly fee: number;
  readonly relayed_by: string;
  readonly lock_time: number;
  readonly tx_index: number;
  readonly double_spend: boolean;
  readonly time: number;
  readonly block_index?: number;
  readonly block_height?: number;
  readonly inputs: readonly BlockchainInput[];
  readonly out: readonly BlockchainOutput[];
  readonly result: number;
  readonly balance: number;
}

/**
 * Address information from blockchain.com API rawaddr endpoint.
 */
export interface BlockchainAddressInfo {
  readonly hash160: string;
  readonly address: string;
  readonly n_tx: number;
  readonly n_unredeemed: number;
  readonly total_received: number;
  readonly total_sent: number;
  readonly final_balance: number;
  readonly txs: readonly BlockchainTransaction[];
}

/**
 * Block information from blockchain.com API.
 */
export interface BlockchainBlock {
  readonly hash: string;
  readonly ver: number;
  readonly prev_block: string;
  readonly mrkl_root: string;
  readonly time: number;
  readonly bits: number;
  readonly next_block?: readonly string[];
  readonly fee: number;
  readonly nonce: number;
  readonly n_tx: number;
  readonly size: number;
  readonly block_index: number;
  readonly main_chain: boolean;
  readonly height: number;
  readonly weight: number;
  readonly tx: readonly BlockchainTransaction[];
}

/**
 * Unspent transaction output from blockchain.com API.
 */
export interface BlockchainUnspentOutput {
  readonly tx_hash: string;
  readonly tx_hash_big_endian: string;
  readonly tx_index: number;
  readonly tx_output_n: number;
  readonly script: string;
  readonly value: number;
  readonly value_hex: string;
  readonly confirmations: number;
}

/**
 * Response from unspent outputs endpoint.
 */
export interface BlockchainUnspentOutputsResponse {
  readonly unspent_outputs: readonly BlockchainUnspentOutput[];
}

/**
 * Ticker price information.
 */
export interface BlockchainTickerCurrency {
  readonly '15m': number;
  readonly last: number;
  readonly buy: number;
  readonly sell: number;
  readonly symbol: string;
}

/**
 * Ticker response mapping currency codes to price info.
 */
export type BlockchainTickerResponse = Record<string, BlockchainTickerCurrency>;

/**
 * Latest block information.
 */
export interface BlockchainLatestBlock {
  readonly hash: string;
  readonly time: number;
  readonly block_index: number;
  readonly height: number;
  readonly txIndexes: readonly number[];
}

/**
 * Multi-address response.
 */
export interface BlockchainMultiAddressResponse {
  readonly addresses: readonly BlockchainAddressInfo[];
  readonly wallet: {
    readonly n_tx: number;
    readonly n_tx_filtered: number;
    readonly total_received: number;
    readonly total_sent: number;
    readonly final_balance: number;
  };
  readonly txs: readonly BlockchainTransaction[];
  readonly info: {
    readonly nconnected: number;
    readonly conversion: number;
    readonly symbol_local: {
      readonly code: string;
      readonly symbol: string;
      readonly name: string;
      readonly conversion: number;
      readonly symbolAppearsAfter: boolean;
      readonly local: boolean;
    };
    readonly symbol_btc: {
      readonly code: string;
      readonly symbol: string;
      readonly name: string;
      readonly conversion: number;
      readonly symbolAppearsAfter: boolean;
      readonly local: boolean;
    };
    readonly latest_block: BlockchainLatestBlock;
  };
}
