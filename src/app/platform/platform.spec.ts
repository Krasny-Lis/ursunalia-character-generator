import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import seedData from '../../../public/data/platform.json';
import { PlatformStore } from './platform.store';
import { Seed, Field, Application } from './models';
import { FormPage } from './form.page';
import { SummaryPage } from './summary.page';
import { BuilderPage } from './builder.page';
import { FieldControl } from './field.control';
import { EventPage } from './event.page';
import { OrganizerPage } from './organizer.page';
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
it('a retained logistics questionnaire never occupies the character slot in demo', () => {
  const questionnaire = store.start(store.forms()[1]);
  const character = store.start(store.forms()[0]);
  expect(character).not.toBe(questionnaire);
  expect(store.active()!.form.id).toBe('character-2027');
  expect(store.applications().some(a => a.id === questionnaire)).toBe(true);
});
it('demo submission never claims to send to an organizer', async () => {
  expect(await store.submit()).toBe(false);
  expect(store.active()!.status).toBe('draft');
  expect(store.notice()).toContain('nie zostało wysłane');
});
it('manual schema save updates existing demo characters without changing status', async () => {
  const first = structuredClone(store.forms()[0]);
  first.sections[0].title = 'Zmieniona tożsamość';
  await store.saveSchema(first, first.revision);
  expect(store.forms().find((f) => f.id === first.id)?.revision).toBe(2);
  expect(store.active()?.form.sections[0].title).toBe('Zmieniona tożsamość');
  expect(store.active()?.status).toBe('draft');
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
  await expect(store.saveSchema(form, form.revision)).rejects.toThrow();
  expect(store.forms()[0].revision).toBe(1);
});

it('server event permissions control the existing builder independently from the global account role', async () => {
  store.mode.set('server');
  store.user.set({ id: 'fixture', name: 'Fixture', email: 'fixture@example.test', role: 'organizer' });
  expect(store.canOrganize()).toBe(true); // Global organizer can open the event-creation screen.
  expect(store.canManageForm(seed.event.id)).toBe(false); // Event management still requires its grant.
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
  store.events.set([seed.event, { ...seed.event, id: 'beta', name: 'Beta event', subtitle: 'Beta subtitle', date: '17 maja 2028', location: 'Gdańsk', locationNote: 'Wejście od ulicy Portowej', description: 'Opowieść o latarnikach przygotowana przez organizatora.' }]);
  store.forms.set([...seed.forms, { ...seed.forms[0], id: 'beta-form', eventId: 'beta', title: 'Beta form' }]);
  store.applications.set([]);
  const harness = await RouterTestingHarness.create('/wydarzenie/beta');
  harness.detectChanges();
  expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Beta event');
  expect(harness.routeNativeElement?.querySelectorAll('.survey-card')).toHaveLength(1);
  expect(harness.routeNativeElement?.querySelector('.survey-card h3')?.textContent).toContain('Beta form');
  const text = harness.routeNativeElement!.textContent!;
  for (const story of ['Budzenie Niedźwiedzi', 'Krywulka', 'Ziemiach Braci', 'kultur Kisleva']) expect(text).not.toContain(story);
  for (const data of ['17 maja 2028', 'Gdańsk', 'Wejście od ulicy Portowej', 'Opowieść o latarnikach']) expect(text).toContain(data);
  expect(store.selectedEvent()?.id).toBe('beta');
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ eventId: 'beta', status: 'joined', joinedAt: '2026-10-14T00:00:00.000Z' }) });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const page = harness.routeDebugElement!.componentInstance as EventPage;
  await page.start(page.forms()[0]);
  expect(fetchMock.mock.calls[0][0].pathname).toBe('/api/events/beta/join');
  expect(store.active()?.form.eventId).toBe('beta');
});

function serverCharacter(status: Application['status'] = 'submitted'): Application {
  store.mode.set('server');
  store.user.set({ id: 'owner', name: 'Owner', email: 'owner@example.test', role: 'participant' });
  store.characterForms.set([{ eventId: seed.event.id, formId: seed.forms[0].id, formRevision: 1 }]);
  const app: Application = { id: 'application-11111111-1111-1111-1111-111111111111', kind: 'character',
    eventId: seed.event.id, form: structuredClone(seed.forms[0]), answers: structuredClone(seed.example),
    status, revision: 7, updatedAt: '2026-10-14T00:00:00.000Z', history: [] };
  store.applications.set([app]); store.activeId.set(app.id); store.dirty.set(false);
  return app;
}

it('submitted character remains editable in real controls; only the saved server result changes status and revision', async () => {
  const app = serverCharacter();
  const fixture = TestBed.createComponent(FormPage);
  await fixture.whenStable();
  const input = fixture.nativeElement.querySelector('#input-name') as HTMLInputElement;
  expect(input.disabled).toBe(false);
  input.value = 'Edited player'; input.dispatchEvent(new Event('input', { bubbles: true }));
  await fixture.whenStable();
  expect(store.active()!.status).toBe('submitted');
  expect(store.dirty()).toBe(true);
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...store.active(), status: 'draft', revision: 8 }) });
  vi.stubGlobal('fetch', fetchMock);
  await store.save();
  expect(fetchMock.mock.calls[0][0].pathname).toBe('/api/characters');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).expectedRevision).toBe(app.revision);
  expect(store.active()!.status).toBe('draft');
  expect(store.active()!.revision).toBe(8);
  expect(store.dirty()).toBe(false);
});

it('save without edits preserves submitted state; accepted player controls and both save buttons are locked', async () => {
  const app = serverCharacter();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => app }));
  await store.save();
  expect(store.active()!.status).toBe('submitted');
  expect(store.active()!.revision).toBe(7);
  store.applications.set([{ ...app, status: 'accepted' }]);
  const fixture = TestBed.createComponent(FormPage);
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('#input-name').disabled).toBe(true);
  const saveButtons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  expect(saveButtons.filter(b => b.textContent?.includes('Zapisz szkic')).every(b => b.disabled)).toBe(true);
  store.update('name', 'Blocked');
  expect(store.active()!.answers['name']).toBe(seed.example['name']);
});

it('stale player save keeps local answers and dirty flag; submit uses the revision returned by save', async () => {
  const app = serverCharacter('rejected');
  store.update('name', 'My local work');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'Konflikt rewizji' }) }));
  await store.save();
  expect(store.active()!.answers['name']).toBe('My local work');
  expect(store.active()!.revision).toBe(7);
  expect(store.dirty()).toBe(true);
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ...app, answers: store.active()!.answers, revision: 8 }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...app, revision: 9, status: 'submitted' }) });
  vi.stubGlobal('fetch', fetchMock);
  expect(await store.submit()).toBe(true);
  expect(fetchMock.mock.calls[1][0].pathname).toBe(`/api/characters/${app.id}/submit`);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ expectedRevision: 8 });
  expect(store.active()!.revision).toBe(9);
});

it('bootstrap combines characters and retained questionnaires; reopening respects the event limit across form revisions', async () => {
  const app = serverCharacter('draft');
  const survey = { ...app, id: 'survey', kind: 'survey', form: seed.forms[1] };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    forms: seed.forms, characters: [app], applications: [survey], user: store.user(),
    events: [seed.event], memberships: [], eventGrants: [], characterForms: store.characterForms(),
  }) }));
  await store.refreshServer();
  expect(store.applications()).toHaveLength(2);
  expect(store.start({ ...seed.forms[0], revision: 2 })).toBe(app.id);
  expect(store.applications()).toHaveLength(2);
  expect(store.active()!.form.revision).toBe(1);
});

it('MG uses existing field controls, preserves edits on conflict and records optional-comment decisions with CAS', async () => {
  const app = { ...serverCharacter(), userName: 'Owner', userEmail: 'owner@example.test' };
  store.eventGrants.set([{ eventId: seed.event.id, role: 'gm' }]);
  const request = vi.spyOn(store, 'request').mockResolvedValueOnce([app]);
  const fixture = TestBed.createComponent(OrganizerPage);
  await fixture.whenStable();
  const page = fixture.componentInstance;
  page.select(app); page.beginEdit(); await fixture.whenStable();
  const input = fixture.nativeElement.querySelector('#input-name') as HTMLInputElement;
  input.value = 'GM work'; input.dispatchEvent(new Event('input', { bubbles: true }));
  await fixture.whenStable();
  request.mockRejectedValueOnce(new Error('Konflikt rewizji'));
  await page.saveEdit();
  expect(page.editAnswers()['name']).toBe('GM work');
  expect(page.selected()!.revision).toBe(7);
  expect(page.editing()).toBe(true);
  expect(store.reviewDirty()).toBe(true);
  request.mockResolvedValueOnce({ ...app, answers: page.editAnswers(), revision: 8 });
  await page.saveEdit();
  expect(page.selected()!.status).toBe('submitted');
  expect(page.editing()).toBe(false);
  const decided = { ...page.selected()!, status: 'rejected' as const, revision: 9, history: [{ id: 'decision', actorId: 'gm',
    actorName: 'Our GM', decidedAt: '2026-10-14T00:00:00.000Z', action: 'decision' as const,
    fromStatus: 'submitted' as const, status: 'rejected' as const, comment: '', characterRevision: 9 }] };
  request.mockResolvedValueOnce(decided);
  page.feedback = ''; await page.review('rejected'); await fixture.whenStable();
  expect(request).toHaveBeenLastCalledWith(`api/organizer/characters/${app.id}/decision`, 'POST',
    { expectedRevision: 8, status: 'rejected', feedback: '' });
  expect(fixture.nativeElement.textContent).toContain('Our GM');
  expect(fixture.nativeElement.textContent).toContain('Odrzucona');
  page.userQuery = 'GM work'; expect(page.filtered()).toHaveLength(1);
  page.filter = 'accepted'; expect(page.filtered()).toHaveLength(0);
});

it('GM unlock sends explicit action/revision and owner summary shows actor, time and optional feedback', async () => {
  const app = serverCharacter('accepted');
  store.eventGrants.set([{ eventId: seed.event.id, role: 'gm' }]);
  const request = vi.spyOn(store, 'request').mockResolvedValueOnce([app]);
  const fixture = TestBed.createComponent(OrganizerPage); await fixture.whenStable();
  fixture.componentInstance.select(app);
  const updated = { ...app, status: 'changes' as const, revision: 8, feedback: 'Make a correction', history: [{
    id: 'unlock', actorId: 'gm', actorName: 'Our GM', decidedAt: '2026-10-14T12:30:00.000Z', action: 'unlock' as const,
    fromStatus: 'accepted' as const, status: 'changes' as const, comment: 'Make a correction', characterRevision: 8,
  }] };
  request.mockResolvedValueOnce(updated);
  fixture.componentInstance.feedback = 'Make a correction';
  await fixture.componentInstance.review('changes', true);
  expect(request).toHaveBeenLastCalledWith(`api/organizer/characters/${app.id}/unlock`, 'POST',
    { expectedRevision: 7, status: 'changes', feedback: 'Make a correction' });
  store.applications.set([updated]);
  const summary = TestBed.createComponent(SummaryPage); await summary.whenStable();
  expect(summary.nativeElement.textContent).toContain('Odblokowanie');
  expect(summary.nativeElement.textContent).toContain('Our GM');
  expect(summary.nativeElement.textContent).toContain('Make a correction');
  expect(summary.nativeElement.textContent).toContain('14.10.2026');
});

it('refresh removes a retracted draft from the MG list and detail, then shows it after resubmission', async () => {
  const app = serverCharacter();
  store.eventGrants.set([{ eventId: seed.event.id, role: 'gm' }]);
  const request = vi.spyOn(store, 'request').mockResolvedValueOnce([app]);
  const fixture = TestBed.createComponent(OrganizerPage); await fixture.whenStable();
  const page = fixture.componentInstance;
  page.select(app); await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('.review-detail')).not.toBeNull();
  expect(fixture.nativeElement.querySelector('option[value=draft]')).toBeNull();
  request.mockResolvedValueOnce([]);
  await page.refresh(); await fixture.whenStable();
  expect(page.applications()).toEqual([]);
  expect(page.selected()).toBeNull();
  expect(fixture.nativeElement.querySelectorAll('.review-item')).toHaveLength(0);
  expect(fixture.nativeElement.querySelector('.review-detail')).toBeNull();
  request.mockResolvedValueOnce([{ ...app, revision: 9 }]);
  await page.refresh(); await fixture.whenStable();
  expect(fixture.nativeElement.querySelectorAll('.review-item')).toHaveLength(1);
});

it('MG answer edit audit renders separately from decision history in the panel and owner summary', async () => {
  const app = { ...serverCharacter(), history: [] };
  store.eventGrants.set([{ eventId: seed.event.id, role: 'gm' }]);
  const request = vi.spyOn(store, 'request').mockResolvedValueOnce([app]);
  const fixture = TestBed.createComponent(OrganizerPage); await fixture.whenStable();
  const page = fixture.componentInstance;
  page.select(app); page.beginEdit(); page.changeAnswer('name', 'GM edited');
  const edited = { ...app, answers: page.editAnswers(), revision: 8, editHistory: [{
    id: 'edit-1', actorId: 'gm', actorName: 'Editing GM', characterId: app.id,
    editedAt: '2026-10-14T10:15:00.000Z', characterRevision: 8,
  }] };
  request.mockResolvedValueOnce(edited);
  await page.saveEdit(); await fixture.whenStable();
  expect(page.selected()!.status).toBe('submitted');
  expect(page.selected()!.history).toEqual([]);
  const text = fixture.nativeElement.querySelector('u-character-history').textContent;
  expect(text).toContain('Historia edycji MG');
  expect(text).toContain('Editing GM');
  expect(text).toContain('14.10.2026');
  expect(text).toContain('rewizja 8');
  expect(text).toContain('Brak nowych decyzji MG');
  store.applications.set([edited]);
  const summary = TestBed.createComponent(SummaryPage); await summary.whenStable();
  expect(summary.nativeElement.querySelector('u-character-history').textContent).toContain('Editing GM');
});

it('builder ignores old persistent drafts and never writes working changes into storage', async () => {
  const oldKey = 'ursunalia:builder:v27:' + seed.forms[0].id;
  localStorage.setItem(oldKey, JSON.stringify({ ...seed.forms[0], title: 'Old local draft' }));
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const fixture = TestBed.createComponent(BuilderPage); await fixture.whenStable();
  const page = fixture.componentInstance;
  expect(page.form().title).toBe(seed.forms[0].title);
  page.meta('title', 'Unsaved new title');
  expect(page.dirty()).toBe(true); expect(store.builderDirty()).toBe(true);
  expect(store.forms()[0].title).toBe(seed.forms[0].title);
  expect(write).not.toHaveBeenCalled(); expect(localStorage.getItem(oldKey)).toContain('Old local draft');
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  expect(page.canLeave()).toBe(false); expect(confirm).toHaveBeenCalled();
  page.meta('title', seed.forms[0].title); expect(page.dirty()).toBe(false);
  expect(page.canLeave()).toBe(true);
});

it('builder retains local fields on 409 and commits the complete form only on explicit manual save', async () => {
  serverCharacter('draft'); store.eventGrants.set([{ eventId: seed.event.id, role: 'organizer' }]);
  const fixture = TestBed.createComponent(BuilderPage); await fixture.whenStable();
  const page = fixture.componentInstance;
  page.meta('title', 'Local work');
  const request = vi.spyOn(store, 'previewSchema').mockRejectedValueOnce(new Error('Konflikt rewizji'));
  await page.publish();
  expect(page.form().title).toBe('Local work'); expect(page.expectedRevision()).toBe(1);
  expect(page.dirty()).toBe(true); expect(page.error()).toContain('Konflikt');
  request.mockResolvedValueOnce({ destructive:false, changes:[], affectedCharacters:0, affectedDeletedCharacters:0, affectedAnswers:0, confirmationToken:'token' });
  const saved = { ...page.form(), revision:2 };
  const commit = vi.spyOn(store, 'saveSchema').mockResolvedValue(saved);
  await page.publish();
  expect(commit).toHaveBeenCalledWith(expect.objectContaining({title:'Local work'}),1,undefined);
  expect(page.dirty()).toBe(false); expect(store.builderDirty()).toBe(false);
  expect(page.expectedRevision()).toBe(2);
});

it('destructive builder save requires explicit checkbox confirmation, offers full backup, and preserves work when confirmation becomes stale', async () => {
  serverCharacter('draft'); store.eventGrants.set([{ eventId: seed.event.id, role:'organizer' }]);
  const fixture = TestBed.createComponent(BuilderPage); await fixture.whenStable();
  const page=fixture.componentInstance;
  page.meta('title','Draft with deletion');
  const impact={destructive:true,changes:[{kind:'field_removed',fieldId:'name'}],affectedCharacters:2,affectedDeletedCharacters:1,affectedAnswers:3,confirmationToken:'preview-token'};
  vi.spyOn(store,'previewSchema').mockResolvedValue(impact);
  const commit=vi.spyOn(store,'saveSchema').mockRejectedValueOnce(new Error('Potwierdź aktualną analizę'));
  await page.publish(); await fixture.whenStable();
  expect(commit).not.toHaveBeenCalled();
  const dialog=fixture.nativeElement.querySelector('[role=dialog]');
  expect(dialog.textContent).toContain('2 aktywnych oraz 1 usuniętych');
  expect(dialog.textContent).toContain('Pobierz pełną kopię JSON');
  await page.confirmSave(); expect(commit).not.toHaveBeenCalled();
  page.confirmLoss.set(true); page.exporting.set(true); await page.confirmSave();
  expect(commit).not.toHaveBeenCalled();
  page.exporting.set(false); await page.confirmSave();
  expect(commit).toHaveBeenCalledWith(expect.objectContaining({title:'Draft with deletion'}),1,impact);
  expect(page.dirty()).toBe(true); expect(page.impact()).toBeNull(); expect(page.form().title).toBe('Draft with deletion');
});

it('restored demo characters use the current committed schema without rewriting their original stored snapshot', async () => {
  const original = structuredClone(store.active()!);
  const current = { ...structuredClone(original.form), revision: 2, title: 'Current demo schema' };
  const raw = JSON.stringify({ version:1, forms:[current,seed.forms[1]], applications:[original], activeId:original.id });
  localStorage.setItem('ursunalia:manuscript:v1',raw);
  const restored=TestBed.runInInjectionContext(()=>new PlatformStore()); await restored.initialize();
  expect(restored.active()!.form.title).toBe('Current demo schema');
  expect(restored.active()!.answers).toEqual(original.answers);
  expect(localStorage.getItem('ursunalia:manuscript:v1')).toBe(raw);
});

it('restored demo refuses a destructive schema mapping and retains the full original copy', async () => {
  const original=structuredClone(store.active()!);
  const current=structuredClone(original.form); current.revision=2;
  current.sections[0].fields=current.sections[0].fields.filter(f=>f.id!=='name');
  const raw=JSON.stringify({version:1,forms:[current],applications:[original],activeId:original.id});
  localStorage.setItem('ursunalia:manuscript:v1',raw);
  const restored=TestBed.runInInjectionContext(()=>new PlatformStore()); await restored.initialize();
  expect(restored.error()).toContain('ręcznego mapowania');
  expect(localStorage.getItem('ursunalia:manuscript:v1')).toBe(raw);
});

it('independent character lock disables player controls without changing status, including submission', async () => {
  const active = { ...store.active()!, kind: 'character' as const, status: 'changes' as const, revision: 3, locked: true };
  store.mode.set('server'); store.applications.set([active]); store.activeId.set(active.id);
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  expect(store.canEdit(active)).toBe(false);
  store.update('name', 'Forbidden'); await store.save(); expect(await store.submit()).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled(); expect(store.active()?.answers['name']).toBe(active.answers['name']);
  const fixture = TestBed.createComponent(FormPage); await fixture.whenStable();
  expect(fixture.nativeElement.textContent).toContain('Karta zablokowana');
  expect(fixture.nativeElement.querySelector('#input-name')?.disabled).toBe(true);
  expect(store.active()?.status).toBe('changes');
});

it('irreversible character actions require explicit confirmation, use the expected revision and preserve local work on conflict', async () => {
  const { CharacterActions } = await import('./character-actions');
  const app = { ...store.active()!, kind: 'character' as const, revision: 7 };
  store.mode.set('server'); store.applications.set([app]); store.activeId.set(app.id); store.dirty.set(true);
  const request = vi.spyOn(store,'request').mockRejectedValue(new Error('Postać zmieniła się. Odśwież dane.'));
  const fixture=TestBed.createComponent(CharacterActions); fixture.componentRef.setInput('app',app); await fixture.whenStable();
  vi.spyOn(window,'confirm').mockReturnValue(false); await fixture.componentInstance.retire(false); expect(request).not.toHaveBeenCalled();
  vi.spyOn(window,'confirm').mockReturnValue(true); await fixture.componentInstance.retire(false);
  expect(request).toHaveBeenCalledWith('api/characters/'+app.id,'DELETE',{expectedRevision:7,confirmDelete:true});
  expect(store.active()).toEqual(app); expect(store.dirty()).toBe(true); expect(fixture.componentInstance.error()).toContain('zmieniła');
});

it('successful retirement clears the targeted local character and loads the archive without resetting another unsaved draft', async () => {
  const app = { ...store.active()!, kind: 'character' as const, revision: 4 };
  const other = { ...app, id: 'another', answers: {name:'Unsaved other'} };
  store.mode.set('server'); store.user.set({id:'owner',name:'Owner',email:'owner@example.test',role:'participant'});
  store.applications.set([app,other]); store.activeId.set(other.id); store.dirty.set(true);
  vi.spyOn(store,'request').mockImplementation(async url => url==='api/archives' ? [{id:app.id}] as any : url==='api/notifications' ? [] : {} as any);
  await store.retireCharacter(app,true);
  expect(store.applications()).toEqual([other]); expect(store.active()).toEqual(other); expect(store.dirty()).toBe(true);
  expect(store.archives()[0].id).toBe(app.id);
});

it('archive reuse explicitly joins the new event and installs a new draft without changing the immutable archive', async () => {
  const archived={id:'old',eventId:seed.event.id,event:structuredClone(seed.event),form:structuredClone(seed.forms[0]),answers:{name:'Old'},status:'accepted' as const,archivedAt:'2026-10-14',revision:3};
  const target={...structuredClone(seed.forms[0]),id:'next-form',eventId:'next',revision:2};
  const saved={id:'new',kind:'character' as const,eventId:'next',form:target,answers:{name:'Old'},status:'draft' as const,revision:1,updatedAt:'2026-10-14',history:[]};
  store.mode.set('server'); store.forms.set([target]); store.characterForms.set([{eventId:'next',formId:target.id,formRevision:2}]);
  store.archives.set([archived]); store.applications.set([]); store.activeId.set('');
  const request=vi.spyOn(store,'request').mockImplementation(async url => url.endsWith('/join') ? {eventId:'next',status:'joined',joinedAt:'2026-10-14'} as any : saved);
  await store.reuseArchive(archived,'next');
  expect(request).toHaveBeenNthCalledWith(1,'api/events/next/join','POST',{});
  expect(request).toHaveBeenNthCalledWith(2,'api/characters/old/reuse','POST',{eventId:'next',expectedSchemaRevision:2});
  expect(store.active()).toEqual(saved); expect(store.archives()).toEqual([archived]); expect(store.active()?.status).toBe('draft');
});

it('notifications show unread and unavailable states; ownership-safe read updates the counter and logout clears private caches', async () => {
  const { NotificationsPage } = await import('./notifications.page');
  store.mode.set('server'); store.user.set({id:'owner',name:'Owner',email:'owner@example.test',role:'participant'});
  const notification={id:'notice',eventId:seed.event.id,characterId:'deleted',kind:'accepted' as const,createdAt:'2026-10-14',readAt:null,comment:'',characterAvailable:false,archiveAvailable:false};
  store.notifications.set([notification]); store.events.set([seed.event]);
  vi.spyOn(store,'request').mockImplementation(async url=> url==='api/notifications' ? [notification] as any : {...notification,readAt:'2026-10-14T12:00:00Z'} as any);
  const fixture=TestBed.createComponent(NotificationsPage); await fixture.whenStable();
  expect(store.unreadCount()).toBe(1); expect(fixture.nativeElement.textContent).toContain('Postać została usunięta.');
  await fixture.componentInstance.read(notification); await fixture.whenStable();
  expect(store.unreadCount()).toBe(0); expect(fixture.nativeElement.textContent).toContain('PRZECZYTANE');
  vi.spyOn(store,'refreshServer').mockRejectedValue(new Error('Offline'));
  await expect(store.logout()).rejects.toThrow('Offline'); expect(store.notifications()).toEqual([]); expect(store.archives()).toEqual([]);
});

it('event administration preserves unsaved data on 409, requires event grants and sends revisions with role changes', async () => {
  const { EventAdminPage } = await import('./event-admin.page');
  store.mode.set('server'); store.user.set({id:'admin',name:'Admin',email:'admin@example.test',role:'organizer'});
  store.events.set([{...seed.event,revision:2,published:true,registrationsOpen:false}]); store.eventGrants.set([{eventId:seed.event.id,role:'organizer'}]);
  const data={event:store.events()[0],participants:[],grants:[]};
  const request=vi.spyOn(store,'request').mockImplementation(async url=>url.endsWith('/administration') ? data as any : [] as any);
  const fixture=TestBed.createComponent(EventAdminPage); await fixture.whenStable();
  fixture.componentInstance.event.name='Local unsaved event'; fixture.componentInstance.changed();
  request.mockRejectedValue(new Error('Wydarzenie zmieniło się. Odśwież dane.'));
  await fixture.componentInstance.save();
  expect(fixture.componentInstance.event.name).toBe('Local unsaved event'); expect(store.adminDirty()).toBe(true);
  expect(fixture.componentInstance.error()).toContain('zmieniło');
  store.adminDirty.set(false);
  await fixture.componentInstance.grant({id:'team',name:'Team',email:'team@example.test'},'gm');
  expect(request).toHaveBeenLastCalledWith(`api/events/${seed.event.id}/grants/team`,'PUT',{role:'gm',expectedRevision:2});
});

it('a pending authenticated bootstrap cannot rehydrate private data after logout', async () => {
  store.mode.set('server'); store.user.set({id:'owner',name:'Owner',email:'owner@example.test',role:'participant'});
  let finish!: (value: unknown) => void;
  const oldResponse=new Promise(resolve=>{finish=resolve;});
  const empty={forms:[],user:null,events:[],eventGrants:[],memberships:[],characterForms:[],characters:[],applications:[],archives:[],notifications:[]};
  const request=vi.spyOn(store,'request').mockResolvedValue(empty as any);
  request.mockImplementationOnce(()=>oldResponse as any);
  const pending=store.refreshServer(); await store.logout();
  finish({...empty,user:{id:'owner'},archives:[{id:'private-archive'}],notifications:[{id:'private-notice'}]});await pending;
  expect(store.user()).toBeNull(); expect(store.archives()).toEqual([]); expect(store.notifications()).toEqual([]);
});

it('background refresh preserves an unsaved local character that was edited while the response was in flight', async () => {
  store.mode.set('server');
  const original={...store.active()!,kind:'character' as const,revision:1};store.applications.set([original]);store.activeId.set(original.id);
  let finish!: (value: unknown) => void;const response=new Promise(resolve=>{finish=resolve;});vi.spyOn(store,'request').mockImplementation(()=>response as any);
  const pending=store.refreshServer();store.update('name','Keep unsaved change');
  finish({forms:store.forms(),user:null,events:[],eventGrants:[],memberships:[],characterForms:[],characters:[original],applications:[]});await pending;
  expect(store.active()?.answers['name']).toBe('Keep unsaved change');expect(store.dirty()).toBe(true);
});

it('switching explicit event routes preserves Ursunalia lore only for its ID and keeps the selected event on the home page', async () => {
  const router = TestBed.inject(Router);
  router.resetConfig([{ path: '', component: EventPage }, { path: 'wydarzenie/:id', component: EventPage }]);
  store.mode.set('server');
  const beta = { ...seed.event, id: 'beta', name: 'Noc latarni', subtitle: 'Opowieści portu', date: '17 maja 2028', location: 'Gdańsk', locationNote: 'Wejście od Portowej', description: 'Własna historia latarników.' };
  store.events.set([seed.event, beta]);
  store.forms.set([...seed.forms, { ...seed.forms[0], id: 'beta-form', eventId: 'beta', title: 'Karta latarnika' }]);
  const harness = await RouterTestingHarness.create('/wydarzenie/ursunalia-2027'); harness.detectChanges();
  expect(harness.routeNativeElement?.textContent).toContain('Budzenie Niedźwiedzi');
  expect(harness.routeNativeElement?.textContent).toContain('Witaj na Ziemiach Braci');
  expect(harness.routeNativeElement?.querySelector('.page-eyebrow')?.textContent).toBe('LARP FANTASY · KISLEV · 2027');
  await harness.navigateByUrl('/wydarzenie/beta', EventPage); harness.detectChanges();
  expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(beta.name);
  expect(harness.routeNativeElement?.querySelector('.page-eyebrow')?.textContent).toBe('WYDARZENIE');
  expect(harness.routeNativeElement?.querySelector('.event-bottom')?.textContent).toContain(beta.description);
  for (const lore of ['Budzenie Niedźwiedzi','Krywulka','Ziemiach Braci','Kisleva','biletach']) expect(harness.routeNativeElement?.textContent).not.toContain(lore);
  expect(harness.routeNativeElement?.querySelectorAll('.survey-card')).toHaveLength(1);
  expect(harness.routeNativeElement?.querySelector('.event-selector [aria-current="page"]')?.textContent).toBe(beta.name);
  expect(store.selectedEvent()?.id).toBe(beta.id);
  await harness.navigateByUrl('/', EventPage); harness.detectChanges();
  expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(beta.name);
  await harness.navigateByUrl('/wydarzenie/ursunalia-2027', EventPage); harness.detectChanges();
  expect(harness.routeNativeElement?.textContent).toContain('Budzenie Niedźwiedzi');
  expect(harness.routeNativeElement?.querySelectorAll('.survey-card')).toHaveLength(seed.forms.length);
});

it('missing event data and unpublished forms show neutral empty states, while unknown direct links never substitute Ursunalia', async () => {
  const router = TestBed.inject(Router); router.resetConfig([{ path: 'wydarzenie/:id', component: EventPage }]);
  store.mode.set('server');
  store.events.set([seed.event,{ ...seed.event, id:'empty-event', name:'Nowe wydarzenie', subtitle:'',date:'',location:'',locationNote:'',description:'' }]);
  const harness = await RouterTestingHarness.create('/wydarzenie/empty-event'); harness.detectChanges();
  expect(harness.routeNativeElement?.textContent).toContain('Organizator nie podał jeszcze opisu wydarzenia.');
  expect(harness.routeNativeElement?.textContent).toContain('Brak opublikowanych formularzy');
  expect(harness.routeNativeElement?.textContent).not.toContain('Krywulka');
  await harness.navigateByUrl('/wydarzenie/unknown',EventPage); harness.detectChanges();
  expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Wydarzenie niedostępne');
  expect(harness.routeNativeElement?.querySelector('.event-bottom')).toBeNull();
  expect(store.selectedEvent()?.id).toBe('empty-event');
});

it('opening a character or its creator selects that event for navigation without persisting a new selection in local storage', async () => {
  const beta = { ...seed.event, id:'beta',name:'Beta event' };
  const betaForm = { ...seed.forms[0], id:'beta-form',eventId:'beta' };
  store.mode.set('server'); store.events.set([seed.event,beta]); store.forms.set([...seed.forms,betaForm]);
  store.characterForms.set([{eventId:beta.id,formId:betaForm.id,formRevision:1}]);
  store.applications.set([{...store.active()!,id:'beta-character',form:betaForm}]);
  const previous=localStorage.getItem('ursunalia:manuscript:v1');
  store.open('beta-character'); expect(store.selectedEvent()?.id).toBe('beta');
  store.selectEvent(seed.event.id);
  store.eventGrants.set([{eventId:beta.id,role:'organizer'}]);
  const router = TestBed.inject(Router); router.resetConfig([{path:'edytor',component:BuilderPage}]);
  await RouterTestingHarness.create('/edytor?id=beta-form');
  expect(store.selectedEvent()?.id).toBe('beta'); expect(localStorage.getItem('ursunalia:manuscript:v1')).toBe(previous);
  store.events.set([seed.event]); expect(store.selectedEvent()?.id).toBe(seed.event.id);
});
