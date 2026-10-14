import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { ParticipantDashboardPage } from './participant-dashboard.page';
import { ParticipantViewStore } from './participant-view.store';
import { UiPreviewStore } from './ui-preview.store';
import { PlatformStore } from './platform.store';
import { routes } from '../app.routes';
import type { Application, FormDefinition, GameEvent, Seed } from './models';

const event: GameEvent = {
  id: 'ursunalia-2027',
  name: 'Ursunalia 2027',
  subtitle: 'Nowe początki, stare długi.',
  date: '22–24 kwietnia 2027',
  location: '',
  locationNote: '',
  description: '',
  status: 'W przygotowaniu',
};
const form: FormDefinition = {
  id: 'character-2027',
  eventId: event.id,
  revision: 1,
  status: 'published',
  title: 'Zgłoszenie postaci',
  description: '',
  sections: [{ id: 'identity', title: 'Tożsamość', fields: [
    { id: 'name', label: 'Imię postaci', type: 'text', required: true },
  ] }],
};
const character: Application = {
  id: 'character-test-1',
  form,
  answers: { name: 'Mirosław' },
  status: 'draft',
  kind: 'character',
  eventId: event.id,
  revision: 1,
  updatedAt: '2026-10-14T10:00:00Z',
};
function setup() {
  TestBed.configureTestingModule({
    imports: [ParticipantDashboardPage],
    providers: [provideRouter(routes)],
  });
  const store = TestBed.inject(PlatformStore);
  const preview = TestBed.inject(UiPreviewStore);
  const projection = TestBed.inject(ParticipantViewStore);
  store.mode.set('demo');
  store.seed.set({ event, forms: [form], example: {} } satisfies Seed);
  store.forms.set([form]);
  preview.setRole('player');
  preview.setCharacter('draft');
  return { store, preview, projection, fixture: TestBed.createComponent(ParticipantDashboardPage) };
}

describe('Mój panel uczestnika', () => {
  it('renders exactly four steps and no profile photograph, notifications or archive', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(root.querySelectorAll('.participant-process-grid li').length).toBe(4);
    for (const step of ['Konto', 'Postać', 'Składka', 'Karta']) expect(text).toContain(step);
    expect(text).toContain('Podgląd deweloperski');
    expect(root.querySelector('img')).toBeNull();
    expect(text).not.toContain('Archiwum postaci');
    expect(text).not.toContain('Powiadomienia');
  });

  it('shows guest login and empty character states', async () => {
    const { preview, fixture } = setup();
    await fixture.whenStable();
    preview.setRole('guest');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Zaloguj się lub załóż konto');
    expect(root.querySelector('.participant-process-grid')).toBeNull();
    preview.setRole('player');
    preview.setCharacter('none');
    await fixture.whenStable();
    expect(root.textContent).toContain('Jeszcze nie masz postaci');
    expect(root.textContent).toContain('Rozpocznij zgłoszenie');
  });

  it('does not treat a simulation as a real bank payment or assigned Google document', async () => {
    const { preview, projection, fixture } = setup();
    preview.setCharacter('accepted');
    preview.setPayment('paid');
    preview.setCard('ready');
    preview.hasCardLink.set(true);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(projection.card().title).toContain('symulacja');
    expect(projection.payment().title).toContain('symulacja');
    expect(root.textContent).toContain('Żaden prawdziwy dokument Google Docs nie został przypisany');
    expect(root.querySelector('a[href*="docs.google.com"]')).toBeNull();
    expect(root.querySelector('a[href*="bank"]')).toBeNull();
    preview.setPayment('unpaid');
    await fixture.whenStable();
    expect(projection.card().title).toBe('Oczekuje na składkę');
  });

  it('uses the existing store to open a draft, without inventing a second form', async () => {
    const { store, preview, fixture } = setup();
    preview.setCharacter('none');
    store.applications.set([]);
    const router = TestBed.inject(Router);
    const start = vi.spyOn(store, 'start').mockReturnValue('character-abc');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
    await fixture.componentInstance.start();
    expect(start).toHaveBeenCalledWith(form);
    expect(navigate).toHaveBeenCalledWith(['/zgloszenie-postaci'], { queryParams: { id: 'character-abc' } });
  });
});

describe('Dane panelu i ograniczenia edycji', () => {
  it('uses real status when not in the simulated player role', () => {
    const { store, preview, projection } = setup();
    preview.setRole('guest');
    store.mode.set('server');
    store.applications.set([{ ...character, status: 'accepted', locked: true }]);
    store.user.set({ id: 'user-1', name: 'Jan', email: 'example@example.com', role: 'participant' });
    expect(projection.status()).toBe('accepted');
    expect(projection.locked()).toBe(true);
    expect(projection.payment().title).toBe('W przygotowaniu');
    expect(projection.canEditRecord(projection.character())).toBe(false);
  });

  it('never bypasses the real record lock through the dev toolbar', () => {
    const { store, preview, projection } = setup();
    store.applications.set([{ ...character, locked: true }]);
    preview.setRole('player');
    preview.setCharacter('draft');
    preview.locked.set(false);
    expect(projection.canEditRecord(projection.character())).toBe(false);
    store.applications.set([{ ...character, locked: false }]);
    preview.locked.set(true);
    expect(projection.canEditRecord(projection.character())).toBe(false);
    preview.locked.set(false);
    expect(projection.canEditRecord(projection.character())).toBe(true);
    preview.setCharacter('accepted');
    expect(projection.canEditRecord(projection.character())).toBe(false);
  });
});
