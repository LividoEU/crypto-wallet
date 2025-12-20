import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Main } from './layout/main/main';
import { Title } from '@angular/platform-browser';
import { Buffer } from 'buffer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Main],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {

  protected titleService = inject(Title);

  protected readonly title:string = "crypto-wallet";

  constructor() {
    (window as any).Buffer = Buffer;
    this.titleService.setTitle($localize`${this.title}`);
  }
}
