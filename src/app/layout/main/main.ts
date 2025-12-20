import { Component } from '@angular/core';
import { Dashboard } from "../dashboard/dashboard";

@Component({
  selector: 'app-main',
  imports: [Dashboard],
  templateUrl: './main.html',
  styleUrl: './main.scss',
})
export class Main {

}
