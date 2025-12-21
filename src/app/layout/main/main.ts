import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Dashboard } from '../dashboard/dashboard';
import { Navbar } from '../navbar/navbar';
import { SidebarContent } from '../sidebar/sidebar-content';

@Component({
  selector: 'app-main',
  imports: [MatSidenavModule, Dashboard, Navbar, SidebarContent],
  templateUrl: './main.html',
  styleUrl: './main.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main {
  sidebarOpen = signal(false);

  onMenuToggle(): void {
    this.sidebarOpen.update((open) => !open);
  }

  onSearch(query: string): void {
    console.log('Search query:', query);
  }
}
