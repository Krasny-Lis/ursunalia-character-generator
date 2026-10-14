import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './home.page';
import { PlatformStore } from './platform.store';
import { routes } from '../app.routes';
import type { FormDefinition, GameEvent, Seed } from './models';

const event: GameEvent = {
  id: 'ursunalia-2027',
  name: 'Ursunalia 2027',
  subtitle: 'Nowe początki. Stare długi.',
  date: '22–24 kwietnia 2027',
  location: 'Krywulka · Ziemie Braci',
  locationNote: 'Adres fizyczny do ogłoszenia.',
  description: 'Wiosna na północnych rubieżach Kisleva.',
  status: 'Zapisy otwarte',
};
const characterForm: FormDefinition = {
  id: 'character-2027',
  eventId: event.id,
  revision: 1,
  status: 'published',
  title: 'Zgłoszenie postaci',
  description: '',
  sections: [],
};

describe('Ursunalia 2027 homepage', () => {
  let store: PlatformStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideRouter(routes)],
    });
    store = TestBed.inject(PlatformStore);
    store.mode.set('demo');
    store.seed.set({ event, forms: [characterForm], example: {} } satisfies Seed);
    store.forms.set([characterForm]);
    store.applications.set([]);
  });

  it('presents an informational hub, without generic event/survey list or invented articles', async () => {
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('Ursunalia');
    expect(text).toContain('22–24 kwietnia 2027');
    expect(text).toContain('Aktualności i ogłoszenia');
    expect(text).toContain('Wkrótce pierwsze komunikaty');
    expect(text).toContain('Adres terenu: do ogłoszenia');
    expect(text).toContain('Kwota i termin: do ogłoszenia');
    expect(text).toContain('Jak dołączyć do gry?');
    expect(root.querySelector('#ankiety')).toBeNull();
    expect(root.querySelector('.survey-cards')).toBeNull();
    expect(root.querySelectorAll('.home-updates img').length).toBe(0);
  });

  it('opens a character draft through the existing store workflow', async () => {
    const router = TestBed.inject(Router);
    const start = vi.spyOn(store, 'start').mockReturnValue('character-17');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Wypróbuj zgłoszenie');
    await fixture.componentInstance.startCharacter();
    expect(start).toHaveBeenCalledWith(characterForm);
    expect(navigate).toHaveBeenCalledWith(['/zgloszenie-postaci'], {
      queryParams: { id: 'character-17' },
    });
  });

  it('does not offer active character registration in closed server mode', async () => {
    store.mode.set('server');
    store.events.set([{ ...event, registrationsOpen: false }]);
    store.forms.set([characterForm]);
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Zamknięte');
    expect(root.querySelector('.home-hero__actions button')).toBeNull();
    expect(root.querySelector('.home-hero__actions a[href="/dla-gracza"]')).not.toBeNull();
  });
});
