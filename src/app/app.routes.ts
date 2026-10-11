import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/character-identity/character-identity').then((m) => m.CharacterIdentity),
  },
  {
    path: 'traits',
    loadComponent: () =>
      import('./features/traits-lab/traits-lab').then((m) => m.TraitsLab),
  },
  {
    path: 'hooks',
    loadComponent: () =>
      import('./features/character-hooks/character-hooks').then((m) => m.CharacterHooks),
  },
  { path: '**', redirectTo: '' },
];
