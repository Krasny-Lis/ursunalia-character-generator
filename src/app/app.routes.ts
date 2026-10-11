import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/traits-lab/traits-lab').then((m) => m.TraitsLab),
  },
  { path: '**', redirectTo: '' },
];
