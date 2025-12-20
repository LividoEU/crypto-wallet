import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  MatBottomSheet,
  MatBottomSheetModule
} from '@angular/material/bottom-sheet';
import { CreateWalletBottomList } from '../../components/create-wallet-bottom-list/create-wallet-bottom-list';

@Component({
  selector: 'app-dashboard',
  imports: [
    MatButtonModule, 
    MatIconModule,
    MatBottomSheetModule
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private _bottomSheet = inject(MatBottomSheet);

  openBottomSheet(): void {
    this._bottomSheet.open(CreateWalletBottomList);
  }
}
