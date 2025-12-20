import { Injectable } from '@angular/core';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from '@scure/bip39';
import { wordlist as english } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { Buffer } from 'buffer';

import { BlockchainService } from '../../interfaces';
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
