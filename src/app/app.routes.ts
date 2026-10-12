import type { Routes } from '@angular/router';
import { moduleEnabledGuard } from './core/guards/module-enabled.guard';

export const routes: Routes = [
  {
    path: '', pathMatch: 'full',
    canMatch: [moduleEnabledGuard('event')],
    loadComponent: () => import('./modules/event/pages/home-page/home-page').then(m => m.HomePage),
  },
  {
    path: 'zgloszenie-postaci',
    canMatch: [moduleEnabledGuard('character')],
    loadComponent: () => import('./modules/character/pages/character-generator-page/character-generator-page').then(m => m.CharacterGeneratorPage),
  },
  {
    path: 'organizator/ankiety/podglad',
    canMatch: [moduleEnabledGuard('surveys')],
    loadComponent: () => import('./modules/surveys/pages/survey-preview-page/survey-preview-page').then(m => m.SurveyPreviewPage),
  },
  {
    path: 'organizator/ankiety',
    canMatch: [moduleEnabledGuard('surveys')],
    loadComponent: () => import('./modules/surveys/pages/surveys-dev-page/surveys-dev-page').then(m => m.SurveysDevPage),
  },
  {
    path: 'modul-niedostepny',
    loadComponent: () => import('./modules/event/pages/module-unavailable/module-unavailable').then(m => m.ModuleUnavailablePage),
  },
  { path: '**', redirectTo: '' },
];
