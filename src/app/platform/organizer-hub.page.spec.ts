import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { OrganizerHubPage } from './organizer-hub.page';
import { PlatformStore } from './platform.store';
import { UiPreviewStore } from './ui-preview.store';
import { routes } from '../app.routes';

function setup() {
  TestBed.configureTestingModule({ imports: [OrganizerHubPage], providers: [provideRouter(routes)] });
  const store = TestBed.inject(PlatformStore);
  const preview = TestBed.inject(UiPreviewStore);
  store.mode.set('demo');
  preview.setRole('organizer');
  return { store, preview, fixture: TestBed.createComponent(OrganizerHubPage) };
}

describe('Organizer console – frontend-only stage', () => {
  it('contains eight approved modules, without archive or notifications', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.admin-side button').length).toBe(8);
    expect(root.textContent).toContain('Panel organizatora');
    expect(root.textContent).toContain('Wersja demonstracyjna');
    expect(root.querySelector('a[href*="powiadomienia"]')).toBeNull();
    expect(root.querySelector('button[aria-label*="Archiwizuj"]')).toBeNull();
    expect(root.querySelectorAll('.admin-metrics>.paper').length).toBe(4);
  });

  it('does not grant real API organizer access when the development role changes', async () => {
    const { store, preview, fixture } = setup();
    await fixture.whenStable();
    expect(store.canAdminEvents()).toBe(false);
    preview.setRole('guest');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Dostęp tylko dla organizatorów');
    expect((fixture.nativeElement as HTMLElement).querySelector('.admin-side')).toBeNull();
    preview.setRole('organizer');
    await fixture.whenStable();
    expect(fixture.componentInstance.canAccess()).toBe(true);
    expect(store.canAdminEvents()).toBe(false);
  });

  it('renders payment and card examples only as unpersisted simulations', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.select('payments');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Backend składek nie jest jeszcze dostępny');
    expect(root.textContent).toContain('Nieopłacona (symulacja)');
    page.demoPaid.set(true);
    await fixture.whenStable();
    expect(root.textContent).toContain('Opłacona (symulacja)');
    page.select('documents');
    page.demoCard.set('ready');
    page.demoHasLink.set(true);
    await fixture.whenStable();
    expect(root.textContent).toContain('Warunki udostępnienia spełnione w symulacji');
    expect(root.querySelector('a[href*="docs.google.com"]')).toBeNull();
  });

  it('starts every new content sample as organizer-only and never publishes it', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.select('content');
    await fixture.whenStable();
    expect(page.cmsVisibility()).toBe('organizer');
    page.cmsTitle.set('Przykładowy szkic');
    page.cmsBody.set('Akapit pierwszy.\n\nAkapit drugi.');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.admin-cms-preview')?.textContent).toContain('Akapit drugi.');
    expect(root.querySelector('button[type="submit"]')).toBeNull();
    expect(root.textContent).toContain('bez publikacji');
  });
});
