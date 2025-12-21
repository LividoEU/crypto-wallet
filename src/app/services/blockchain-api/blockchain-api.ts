import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  BlockchainAddressInfo,
  BlockchainBlock,
  BlockchainTransaction,
  BlockchainUnspentOutputsResponse,
  BlockchainTickerResponse,
  BlockchainLatestBlock,
  BlockchainMultiAddressResponse,
} from './blockchain-api.types';

/**
 * Service for interacting with the blockchain.com API.
 * Provides methods to fetch Bitcoin blockchain data including addresses,
 * transactions, blocks, and market data.
 *
 * @see https://www.blockchain.com/es/explorer/api
 */
@Injectable({
  providedIn: 'root',
})
export class BlockchainApiService {
  readonly #http = inject(HttpClient);
  readonly #baseUrl = 'https://blockchain.info';

  /**
   * Get address information including transaction history.
   * @param address Bitcoin address
   * @param limit Number of transactions to return (max 50)
   * @param offset Transaction offset for pagination
   * @returns Observable of address information
   * @example
   * blockchainApi.getAddressInfo('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa').subscribe(info => {
   *   console.log('Balance:', info.final_balance);
   * });
   */
  getAddressInfo(
    address: string,
    limit = 50,
    offset = 0
  ): Observable<BlockchainAddressInfo> {
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString());

    return this.#http.get<BlockchainAddressInfo>(
      `${this.#baseUrl}/rawaddr/${address}`,
      { params }
    );
  }

  /**
   * Get information for multiple addresses.
   * @param addresses Array of Bitcoin addresses
   * @param limit Number of transactions to return
   * @param offset Transaction offset for pagination
   * @returns Observable of multi-address response
   */
  getMultiAddressInfo(
    addresses: readonly string[],
    limit = 50,
    offset = 0
  ): Observable<BlockchainMultiAddressResponse> {
    const params = new HttpParams()
      .set('active', addresses.join('|'))
      .set('n', limit.toString())
      .set('offset', offset.toString());

    return this.#http.get<BlockchainMultiAddressResponse>(
      `${this.#baseUrl}/multiaddr`,
      { params }
    );
  }

  /**
   * Get transaction details by hash.
   * @param txHash Transaction hash
   * @returns Observable of transaction details
   */
  getTransaction(txHash: string): Observable<BlockchainTransaction> {
    return this.#http.get<BlockchainTransaction>(
      `${this.#baseUrl}/rawtx/${txHash}`
    );
  }

  /**
   * Get block details by hash.
   * @param blockHash Block hash
   * @returns Observable of block details
   */
  getBlockByHash(blockHash: string): Observable<BlockchainBlock> {
    return this.#http.get<BlockchainBlock>(
      `${this.#baseUrl}/rawblock/${blockHash}`
    );
  }

  /**
   * Get block details by height.
   * @param height Block height
   * @returns Observable of block details
   */
  getBlockByHeight(height: number): Observable<BlockchainBlock> {
    return this.#http.get<BlockchainBlock>(
      `${this.#baseUrl}/block-height/${height}`,
      { params: { format: 'json' } }
    );
  }

  /**
   * Get unspent transaction outputs for an address.
   * @param address Bitcoin address
   * @param confirmations Minimum confirmations required
   * @returns Observable of unspent outputs
   */
  getUnspentOutputs(
    address: string,
    confirmations = 0
  ): Observable<BlockchainUnspentOutputsResponse> {
    const params = new HttpParams().set(
      'confirmations',
      confirmations.toString()
    );

    return this.#http.get<BlockchainUnspentOutputsResponse>(
      `${this.#baseUrl}/unspent`,
      { params: params.set('active', address) }
    );
  }

  /**
   * Get the latest block information.
   * @returns Observable of latest block
   */
  getLatestBlock(): Observable<BlockchainLatestBlock> {
    return this.#http.get<BlockchainLatestBlock>(
      `${this.#baseUrl}/latestblock`
    );
  }

  /**
   * Get current Bitcoin ticker prices in various currencies.
   * @returns Observable of ticker prices
   */
  getTicker(): Observable<BlockchainTickerResponse> {
    return this.#http.get<BlockchainTickerResponse>(
      `${this.#baseUrl}/ticker`
    );
  }

  /**
   * Get the current Bitcoin balance for an address in satoshis.
   * @param address Bitcoin address
   * @returns Observable of balance in satoshis
   */
  getBalance(address: string): Observable<Record<string, { final_balance: number; n_tx: number; total_received: number }>> {
    return this.#http.get<Record<string, { final_balance: number; n_tx: number; total_received: number }>>(
      `${this.#baseUrl}/balance`,
      { params: { active: address } }
    );
  }

  /**
   * Convert satoshis to BTC.
   * @param satoshis Amount in satoshis
   * @returns Amount in BTC
   */
  satoshisToBtc(satoshis: number): number {
    return satoshis / 100_000_000;
  }

  /**
   * Convert BTC to satoshis.
   * @param btc Amount in BTC
   * @returns Amount in satoshis
   */
  btcToSatoshis(btc: number): number {
    return Math.round(btc * 100_000_000);
  }
}
