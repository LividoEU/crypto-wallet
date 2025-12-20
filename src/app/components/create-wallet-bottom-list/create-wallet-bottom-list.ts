import { Component, inject } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatListModule } from '@angular/material/list';
import { WalletService } from '../../services/wallet/wallet';
import { BlockchainNetworks } from '../../models';

type BitcoinNetwork = BlockchainNetworks['bitcoin'];

@Component({
  selector: 'app-create-wallet-bottom-list',
  imports: [MatListModule],
  templateUrl: './create-wallet-bottom-list.html',
  styleUrl: './create-wallet-bottom-list.scss',
})
export class CreateWalletBottomList {
  #walletService = inject(WalletService);
  #bottomSheetRef = inject<MatBottomSheetRef<CreateWalletBottomList>>(MatBottomSheetRef);

  selectNetwork(event: MouseEvent, network: BitcoinNetwork): void {
    event.preventDefault();
    this.#bottomSheetRef.dismiss();
    this.#walletService.createWallet('bitcoin', network);
  }
}
