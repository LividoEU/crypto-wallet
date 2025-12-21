import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Main } from './layout/main/main';
import { Title } from '@angular/platform-browser';
import { Buffer } from 'buffer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Main],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  #titleService = inject(Title);

  constructor() {
    (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
    this.#titleService.setTitle('Crypto Wallet');
  }
}
