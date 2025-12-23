import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'address/:address',
    loadComponent: () =>
      import('./layout/address-detail/address-detail').then((m) => m.AddressDetail),
  },
];
