import { Injectable } from '@angular/core';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from '@scure/bip39';
import { wordlist as english } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { Buffer } from 'buffer';

import { AddressBranch, BlockchainService, DerivedAddress } from '../../interfaces';
import { BitcoinWalletInfo, BlockchainNetworks, WalletCreationOptions } from '../../models';

type BitcoinNetwork = BlockchainNetworks['bitcoin'];

const BITCOIN_NETWORKS = ['mainnet', 'testnet'] as const;

@Injectable({
  providedIn: 'root',
})
export class BitcoinService implements BlockchainService<BitcoinNetwork, BitcoinWalletInfo> {
  readonly blockchainType = 'bitcoin' as const;
  readonly supportedNetworks = BITCOIN_NETWORKS;

  createWallet(network: BitcoinNetwork, options?: WalletCreationOptions): BitcoinWalletInfo {
    const btcNetwork = network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
    const coinType = network === 'mainnet' ? 0 : 1;
    const derivationPath = `m/84'/${coinType}'/0'/0/0`;
    const entropyBits = options?.entropyBits ?? 256;

    // 1. Generate mnemonic
    const mnemonic = bip39.generateMnemonic(english, entropyBits);

    // 2. Mnemonic -> seed
    const seed = bip39.mnemonicToSeedSync(mnemonic);

    // 3. Root HD key
    const root = HDKey.fromMasterSeed(seed);

    // 4. Derive account
    const child = root.derive(derivationPath);
    if (!child.privateKey || !child.publicKey) {
      throw new Error('Key derivation failed');
    }

    // 5. Create native segwit (bech32) address
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(child.publicKey),
      network: btcNetwork,
    });
    if (!address) {
      throw new Error('Address generation failed');
    }

    return {
      blockchain: 'bitcoin',
      network,
      mnemonic,
      derivationPath,
      privateKey: Buffer.from(child.privateKey).toString('hex'),
      publicKey: Buffer.from(child.publicKey).toString('hex'),
      address,
      addressType: 'p2wpkh',
      createdAt: new Date(),
    };
  }

  /**
   * Derive an address at a specific index from a mnemonic.
   * Uses BIP84 derivation path for native segwit addresses.
   * @param mnemonic The mnemonic phrase
   * @param index The address index
   * @param network The Bitcoin network (mainnet or testnet)
   * @param branch The address branch (receive = 0, change = 1)
   * @returns The derived address information
   */
  deriveAddressAtIndex(
    mnemonic: string,
    index: number,
    network: BitcoinNetwork = 'mainnet',
    branch: AddressBranch = 'receive'
  ): DerivedAddress {
    const btcNetwork = network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
    const coinType = network === 'mainnet' ? 0 : 1;
    const branchIndex = branch === 'receive' ? 0 : 1;
    const derivationPath = `m/84'/${coinType}'/0'/${branchIndex}/${index}`;

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = HDKey.fromMasterSeed(seed);
    const child = root.derive(derivationPath);

    if (!child.publicKey) {
      throw new Error('Key derivation failed');
    }

    const { address } = bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(child.publicKey),
      network: btcNetwork,
    });

    if (!address) {
      throw new Error('Address generation failed');
    }

    return {
      address,
      derivationPath,
      index,
      branch,
    };
  }

  /**
   * Derive multiple addresses from a mnemonic.
   * @param mnemonic The mnemonic phrase
   * @param startIndex The starting index
   * @param count The number of addresses to derive
   * @param network The Bitcoin network
   * @param branch The address branch (receive = 0, change = 1)
   * @returns Array of derived addresses
   */
  deriveAddresses(
    mnemonic: string,
    startIndex: number,
    count: number,
    network: BitcoinNetwork = 'mainnet',
    branch: AddressBranch = 'receive'
  ): DerivedAddress[] {
    const addresses: DerivedAddress[] = [];
    for (let i = 0; i < count; i++) {
      addresses.push(this.deriveAddressAtIndex(mnemonic, startIndex + i, network, branch));
    }
    return addresses;
  }

  /**
   * Get the private key for a specific derivation path.
   * Used for transaction signing.
   * @param mnemonic The mnemonic phrase
   * @param derivationPath The full derivation path
   * @returns The private key as a Buffer
   */
  getPrivateKeyForPath(mnemonic: string, derivationPath: string): Buffer {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = HDKey.fromMasterSeed(seed);
    const child = root.derive(derivationPath);

    if (!child.privateKey) {
      throw new Error('Private key derivation failed');
    }

    return Buffer.from(child.privateKey);
  }

  validateAddress(address: string, network?: BitcoinNetwork): boolean {
    try {
      const btcNetwork =
        network === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

      // Try to decode as bech32 (native segwit)
      bitcoin.address.toOutputScript(address, btcNetwork);
      return true;
    } catch {
      return false;
    }
  }

  validateMnemonic(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic, english);
  }
}
