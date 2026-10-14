import type { Routes } from '@angular/router';

const planned = () => import('./platform/preview-public.page').then(m => m.PreviewPublicPage);

export const routes: Routes = [
  { path: '', loadComponent: () => import('./platform/event.page').then(m => m.EventPage) },
  { path: 'o-wydarzeniu', loadComponent: planned,
    data: { title: 'O wydarzeniu', description: 'Termin, program, dojazd, najważniejsze informacje i kontakt do organizatorów.' } },
  { path: 'swiat-gry', loadComponent: planned,
    data: { title: 'Świat gry', description: 'Kompendium Kisleva, Ziem Braci i materiałów fabularnych.' } },
  { path: 'dla-gracza', loadComponent: planned,
    data: { title: 'Dla gracza', description: 'Poradniki, zasady i informacje potrzebne do przygotowania się do LARPa.' } },
  { path: 'aktualnosci', loadComponent: planned,
    data: { title: 'Aktualności', description: 'Ogłoszenia i bieżące informacje organizatorów Ursunaliów.' } },
  { path: 'wydarzenie/:id', loadComponent: () => import('./platform/event.page').then((m) => m.EventPage) },
  { path: 'zgloszenie-postaci', loadComponent: () => import('./platform/form.page').then((m) => m.FormPage) },
  { path: 'karta-postaci', loadComponent: () => import('./platform/summary.page').then((m) => m.SummaryPage) },
  { path: 'moje-postacie', loadComponent: () => import('./platform/applications.page').then((m) => m.ApplicationsPage) },
  { path: 'organizator/ankiety/edytor',
    canDeactivate: [(component: { canLeave: () => boolean }) => component.canLeave()],
    loadComponent: () => import('./platform/builder.page').then((m) => m.BuilderPage) },
  { path: 'organizator/ankiety/podglad', redirectTo: 'zgloszenie-postaci', pathMatch: 'full' },
  { path: 'organizator/ankiety',
    canDeactivate: [(component: { canLeave: () => boolean }) => component.canLeave()],
    loadComponent: () => import('./platform/organizer.page').then((m) => m.OrganizerPage) },
  { path: 'konto', loadComponent: () => import('./platform/account.page').then((m) => m.AccountPage) },
  { path: 'powiadomienia', loadComponent: () => import('./platform/notifications.page').then(m => m.NotificationsPage) },
  { path: 'organizator/wydarzenia',
    canDeactivate: [(component: { canLeave: () => boolean }) => component.canLeave()],
    loadComponent: () => import('./platform/event-admin.page').then(m => m.EventAdminPage) },
  { path: '**', redirectTo: '' },
];
