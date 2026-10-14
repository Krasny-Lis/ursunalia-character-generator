import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import seedData from '../../../public/data/platform.json';
import { PlatformStore } from './platform.store';
import { Seed, Field } from './models';
import { FormPage } from './form.page';
import { SummaryPage } from './summary.page';
import { BuilderPage } from './builder.page';
import { FieldControl } from './field.control';
import { EventPage } from './event.page';
import { answerIssues } from '../../../shared/validation.mjs';
const seed = seedData as Seed;
let store: PlatformStore;
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  store = TestBed.inject(PlatformStore);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: URL) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            url.pathname.endsWith('runtime-config.json') ? { mode: 'demo' } : structuredClone(seed),
          ),
      }),
    ),
  );
  await store.initialize();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('boots with exactly one complete example and preserves edits after a new service instance', async () => {
  expect(store.applications()).toHaveLength(1);
  expect(answerIssues(store.active()!.form, store.active()!.answers)).toEqual({});
  store.update('name', 'Nowa Alena');
  const restored = TestBed.runInInjectionContext(() => new PlatformStore());
  await restored.initialize();
  expect(restored.active()!.answers['name']).toBe('Nowa Alena');
});
it('creates a blank draft without deleting the example and reopens the same application', () => {
  const id = store.start(store.forms()[0]);
  expect(store.applications()).toHaveLength(2);
  expect(store.active()!.answers).toEqual({});
  expect(store.start(store.forms()[0])).toBe(id);
  expect(store.applications()).toHaveLength(2);
});
it('demo submission never claims to send to an organizer', async () => {
  expect(await store.submit()).toBe(false);
  expect(store.active()!.status).toBe('draft');
  expect(store.notice()).toContain('nie zostało wysłane');
});
it('publishing creates a new survey revision while a participant snapshot stays fixed', async () => {
  const first = structuredClone(store.forms()[0]);
  first.sections[0].title = 'Zmieniona tożsamość';
  await store.publish(first);
  expect(store.forms().find((f) => f.id === first.id)?.revision).toBe(2);
  expect(store.active()?.form.sections[0].title).toBe('Tożsamość postaci');
});
it('storage quota failure stays visible and leaves the current answers in memory', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Quota', 'QuotaExceededError');
  });
  store.update('name', 'W pamięci');
  expect(store.active()!.answers['name']).toBe('W pamięci');
  expect(store.storageError()).toBe(true);
});
it('migrates the previous generator session without overwriting its original data', async () => {
  localStorage.clear();
  const old = JSON.stringify({
    version: 1,
    characters: [
      {
        id: 'my-old-character',
        name: 'Dymitr',
        roleId: 'military-nobility',
        story: { history: 'Historia' },
        relations: [],
      },
    ],
  });
  sessionStorage.setItem('ursunalia:character-generator:session:v1', old);
  const migrated = TestBed.runInInjectionContext(() => new PlatformStore());
  await migrated.initialize();
  expect(migrated.applications().some((a) => a.answers['name'] === 'Dymitr')).toBe(true);
  expect(sessionStorage.getItem('ursunalia:character-generator:session:v1')).toBe(old);
});
it('renders all seven sections and updates the live summary through actual form controls', async () => {
  const fixture = TestBed.createComponent(FormPage);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  expect(root.querySelectorAll('.form-section')).toHaveLength(7);
  const input = root.querySelector('#input-name') as HTMLInputElement;
  input.value = 'Katarzyna';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await fixture.whenStable();
  expect(store.active()!.answers['name']).toBe('Katarzyna');
  const summary = TestBed.createComponent(SummaryPage);
  await summary.whenStable();
  expect(summary.nativeElement.querySelector('.character-hero h2').textContent).toContain(
    'Katarzyna',
  );
  expect(summary.nativeElement.querySelector('.completeness').textContent).toContain('7 / 7');
});
it('new empty draft displays missing required fields and incomplete progress', async () => {
  store.start(store.forms()[0]);
  const fixture = TestBed.createComponent(FormPage);
  await fixture.whenStable();
  fixture.componentInstance.review();
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelectorAll('.field-error').length).toBeGreaterThan(10);
  expect(fixture.componentInstance.completed()).toBeLessThan(7);
});
it('multiselect updates through controls and supports revealing all catalog choices', async () => {
  const fixture = TestBed.createComponent(FieldControl);
  fixture.componentRef.setInput('field', seed.forms[0].sections[2].fields[0]);
  fixture.componentRef.setInput('value', []);
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  await fixture.whenStable();
  const checkbox = fixture.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement;
  checkbox.click();
  expect(changed).toHaveBeenCalledWith([seed.forms[0].sections[2].fields[0].options![0].id]);
  expect(fixture.nativeElement.querySelectorAll('input[type=checkbox]')).toHaveLength(9);
  fixture.nativeElement.querySelector('.text-button').click();
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelectorAll('input[type=checkbox]').length).toBeGreaterThan(9);
});
it('renders described select choices in the CDK overlay above the form cards', async () => {
  const select = seed.forms[0].sections.flatMap(s => s.fields).find(f => f.type === 'select')!;
  expect(select).toBeDefined();
  const fixture = TestBed.createComponent(FieldControl);
  fixture.componentRef.setInput('field', select);
  fixture.componentRef.setInput('value', '');
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  await fixture.whenStable();
  const trigger = fixture.nativeElement.querySelector('.described-select-trigger') as HTMLButtonElement;
  trigger.click();
  await fixture.whenStable();
  const options = document.querySelector('.cdk-overlay-container .described-select-options');
  expect(options).not.toBeNull();
  expect(fixture.nativeElement.querySelector('.described-select-options')).toBeNull();
  (options!.querySelectorAll('button')[1] as HTMLButtonElement).click();
  await fixture.whenStable();
  expect(changed).toHaveBeenCalledWith(select.options![0].id);
  expect(fixture.componentInstance.dropdownOpen()).toBe(false);
  fixture.destroy();
});
it('builder supports creation, edits, duplicate, drag order and an interactive preview', async () => {
  const fixture = TestBed.createComponent(BuilderPage);
  await fixture.whenStable();
  const c = fixture.componentInstance;
  const original = c.count();
  c.select(c.form().sections[0].id);
  c.add('date');
  await fixture.whenStable();
  expect(c.count()).toBe(original + 1);
  const s = c.form().sections[0],
    f = s.fields.at(-1)!;
  c.patch(s.id, f.id, { label: 'Przyjazd', required: true });
  c.duplicateField(s.id, f.id);
  expect(c.count()).toBe(original + 2);
  const fieldIds = c.form().sections.flatMap((s) => s.fields.map((f) => f.id));
  expect(new Set(fieldIds).size).toBe(fieldIds.length);
  c.shiftField(s.id, s.fields.length - 1, -1);
  expect(c.form().sections[0].fields.at(-3)?.label).toBe('Przyjazd');
  c.mode.set('preview');
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelectorAll('u-field').length).toBe(c.count());
  expect(fixture.nativeElement.querySelector('input[type=date]')).not.toBeNull();
});
it('invalid published definitions are rejected before updating the participant list', async () => {
  const form = structuredClone(store.forms()[0]);
  form.sections[0].fields[0].label = '';
  await expect(store.publish(form)).rejects.toThrow();
  expect(store.forms()[0].revision).toBe(1);
});

it('server event permissions control the existing builder independently from the global account role', async () => {
  store.mode.set('server');
  store.user.set({ id: 'fixture', name: 'Fixture', email: 'fixture@example.test', role: 'organizer' });
  expect(store.canOrganize()).toBe(false);
  store.eventGrants.set([{ eventId: seed.event.id, role: 'gm' }]);
  expect(store.canOrganize()).toBe(true);
  const fixture = TestBed.createComponent(BuilderPage);
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('.builder-heading')).toBeNull();
  store.eventGrants.set([{ eventId: 'other-event', role: 'organizer' }]);
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('.builder-heading')).toBeNull();
  store.eventGrants.set([{ eventId: seed.event.id, role: 'organizer' }]);
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('.builder-heading')).not.toBeNull();
});

it('the existing start action explicitly joins before creating an unsaved draft', async () => {
  store.mode.set('server');
  store.user.set({ id: 'fixture', name: 'Fixture', email: 'fixture@example.test', role: 'participant' });
  store.applications.set([]);
  store.events.set([{ ...seed.event, published: true, registrationsOpen: true }]);
  const membership = { eventId: seed.event.id, status: 'joined', joinedAt: '2026-10-14T00:00:00.000Z', source: 'explicit' };
  const fetchMock = vi.fn().mockImplementation(async () => {
    expect(store.applications()).toHaveLength(0);
    return { ok: true, json: async () => membership };
  });
  vi.stubGlobal('fetch', fetchMock);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(EventPage);
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('.survey-card button').textContent).toContain('Dołącz i wypełnij');
  await fixture.componentInstance.start(seed.forms[0]);
  expect(fetchMock.mock.calls[0][0].pathname).toBe(`/api/events/${seed.event.id}/join`);
  expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  expect(store.memberships()).toEqual([membership]);
  expect(store.active()?.answers).toEqual({});
  expect(navigate).toHaveBeenCalledWith(['/zgloszenie-postaci'], { queryParams: { id: store.activeId() } });
});

it('closed registrations leave no new draft and preserve a useful error on the current event page', async () => {
  store.mode.set('server');
  store.user.set({ id: 'fixture', name: 'Fixture', email: 'fixture@example.test', role: 'participant' });
  store.applications.set([]);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'Zapisy na wydarzenie są zamknięte.' }) }));
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(EventPage);
  await fixture.componentInstance.start(seed.forms[0]);
  expect(store.applications()).toHaveLength(0);
  expect(store.memberships()).toHaveLength(0);
  expect(store.notice()).toContain('zamknięte');
  expect(store.busy()).toBe(false);
  expect(navigate).not.toHaveBeenCalled();
});

it('logout clears private event data and permissions even when the anonymous refresh fails', async () => {
  store.mode.set('server');
  store.eventGrants.set([{ eventId: seed.event.id, role: 'organizer' }]);
  store.events.set([{ ...seed.event, name: 'Private event data' }]);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }).mockRejectedValueOnce(new Error('Offline')));
  await expect(store.logout()).rejects.toThrow('Offline');
  expect(store.user()).toBeNull();
  expect(store.eventGrants()).toHaveLength(0);
  expect(store.events()).toHaveLength(0);
  expect(store.forms()).toHaveLength(0);
});

it('event routes show only the chosen persistent event and join it through the existing action', async () => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'wydarzenie/:id', component: EventPage }])] });
  store = TestBed.inject(PlatformStore);
  await store.initialize();
  store.mode.set('server');
  store.user.set({ id: 'fixture', name: 'Fixture', email: 'fixture@example.test', role: 'participant' });
  store.events.set([seed.event, { ...seed.event, id: 'beta', name: 'Beta event', subtitle: 'Beta subtitle' }]);
  store.forms.set([...seed.forms, { ...seed.forms[0], id: 'beta-form', eventId: 'beta', title: 'Beta form' }]);
  store.applications.set([]);
  const harness = await RouterTestingHarness.create('/wydarzenie/beta');
  harness.detectChanges();
  expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Beta event');
  expect(harness.routeNativeElement?.querySelectorAll('.survey-card')).toHaveLength(1);
  expect(harness.routeNativeElement?.querySelector('.survey-card h3')?.textContent).toContain('Beta form');
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ eventId: 'beta', status: 'joined', joinedAt: '2026-10-14T00:00:00.000Z' }) });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const page = harness.routeDebugElement!.componentInstance as EventPage;
  await page.start(page.forms()[0]);
  expect(fetchMock.mock.calls[0][0].pathname).toBe('/api/events/beta/join');
  expect(store.active()?.form.eventId).toBe('beta');
});
