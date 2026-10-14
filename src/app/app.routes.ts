import type { Routes } from '@angular/router';
export const routes: Routes = [
  { path: '', loadComponent: () => import('./platform/event.page').then((m) => m.EventPage) },
  {
    path: 'wydarzenie/:id',
    loadComponent: () => import('./platform/event.page').then((m) => m.EventPage),
  },
  {
    path: 'zgloszenie-postaci',
    loadComponent: () => import('./platform/form.page').then((m) => m.FormPage),
  },
  {
    path: 'karta-postaci',
    loadComponent: () => import('./platform/summary.page').then((m) => m.SummaryPage),
  },
  {
    path: 'moje-postacie',
    loadComponent: () => import('./platform/applications.page').then((m) => m.ApplicationsPage),
  },
  {
    path: 'organizator/ankiety/edytor',
    canDeactivate: [(component: { canLeave: () => boolean }) => component.canLeave()],
    loadComponent: () => import('./platform/builder.page').then((m) => m.BuilderPage),
  },
  { path: 'organizator/ankiety/podglad', redirectTo: 'zgloszenie-postaci', pathMatch: 'full' },
  {
    path: 'organizator/ankiety',
    canDeactivate: [(component: { canLeave: () => boolean }) => component.canLeave()],
    loadComponent: () => import('./platform/organizer.page').then((m) => m.OrganizerPage),
  },
  {
    path: 'konto',
    loadComponent: () => import('./platform/account.page').then((m) => m.AccountPage),
  },
  { path: 'powiadomienia', loadComponent: () => import('./platform/notifications.page').then(m => m.NotificationsPage) },
  {
    path: 'organizator/wydarzenia',
    canDeactivate: [(component: { canLeave: () => boolean }) => component.canLeave()],
    loadComponent: () => import('./platform/event-admin.page').then(m => m.EventAdminPage),
  },
  { path: '**', redirectTo: '' },
];
