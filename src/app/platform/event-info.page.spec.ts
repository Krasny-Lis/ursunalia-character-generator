import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { EventInfoPage } from './event-info.page';
import { PlatformStore } from './platform.store';
import { routes } from '../app.routes';
import type { GameEvent, Seed } from './models';

const event: GameEvent = {
  id: 'ursunalia-2027',
  name: 'Ursunalia 2027',
  subtitle: 'Nowe początki, stare długi.',
  date: '22–24 kwietnia 2027',
  description: 'Historia Ziem Braci.',
  location: 'Krywulka · Ziemie Braci',
  locationNote: 'W świecie gry',
  status: 'W przygotowaniu',
};
describe('Informacje o wydarzeniu', () => {
  function setup(mode: 'demo' | 'server' = 'demo', registrationsOpen?: boolean) {
    TestBed.configureTestingModule({ imports: [EventInfoPage], providers: [provideRouter(routes)] });
    const store = TestBed.inject(PlatformStore);
    store.mode.set(mode);
    store.seed.set({ event, forms: [], example: {} } satisfies Seed);
    store.events.set([{ ...event, registrationsOpen }]);
    return TestBed.createComponent(EventInfoPage);
  }

  it('shows approved date but never guesses a real location, fee or program', async () => {
    const fixture = setup();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('22–24 kwietnia 2027');
    expect(text).toContain('Adres');
    expect(text).toContain('Do ogłoszenia');
    expect(text).toContain('Program ramowy');
    expect(text).toContain('Harmonogram w przygotowaniu');
    expect(text).toContain('Najczęstsze pytania');
    expect(root.querySelector('iframe')).toBeNull();
    expect(root.querySelector('a[href*="maps.google"]')).toBeNull();
    expect(root.querySelectorAll('details').length).toBe(5);
  });

  it('displays the registration status only from real server event settings', async () => {
    const fixture = setup('server', false);
    await fixture.whenStable();
    expect(fixture.componentInstance.registrationStatus()).toBe('Zamknięte');
    const store = TestBed.inject(PlatformStore);
    store.events.set([{ ...event, registrationsOpen: true }]);
    await fixture.whenStable();
    expect(fixture.componentInstance.registrationStatus()).toBe('Otwarte');
    store.events.set([{ ...event }]);
    await fixture.whenStable();
    expect(fixture.componentInstance.registrationStatus()).toBe('Do ogłoszenia');
  });
});
