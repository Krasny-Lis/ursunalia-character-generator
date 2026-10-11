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
  {
    path: 'history',
    loadComponent: () =>
      import('./features/character-history/character-history').then((m) => m.CharacterHistory),
  },
  {
    path: 'pillars',
    loadComponent: () =>
      import('./features/character-pillars/character-pillars').then((m) => m.CharacterPillars),
  },
  {
    path: 'gameplay',
    loadComponent: () =>
      import('./features/character-gameplay/character-gameplay').then((m) => m.CharacterGameplay),
  },
  {
    path: 'relations',
    loadComponent: () =>
      import('./features/character-relations/character-relations').then((m) => m.CharacterRelations),
  },
  { path: '**', redirectTo: '' },
];
