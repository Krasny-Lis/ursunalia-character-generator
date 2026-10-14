import { Injectable, signal, computed } from '@angular/core';
import { Answers, Application, FormDefinition, Seed, User, GameEvent, EventGrant, EventMembership, CharacterForm, ArchivedCharacter, AppNotification } from './models';
import { answerIssues, definitionIssues } from '../../../shared/validation.mjs';
import { schemaChanges, transformAnswers, type SchemaChange } from '../../../shared/schema-impact.mjs';
export interface SchemaImpact {
  destructive: boolean; changes: SchemaChange[]; affectedCharacters: number;
  affectedDeletedCharacters: number; affectedAnswers: number; confirmationToken: string;
}
const KEY = 'ursunalia:manuscript:v1';
export const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
@Injectable({ providedIn: 'root' })
export class PlatformStore {
  readonly seed = signal<Seed | null>(null);
  readonly forms = signal<FormDefinition[]>([]);
  readonly applications = signal<Application[]>([]);
  readonly user = signal<User | null>(null);
  readonly events = signal<GameEvent[]>([]);
  readonly eventGrants = signal<EventGrant[]>([]);
  readonly memberships = signal<EventMembership[]>([]);
  readonly characterForms = signal<CharacterForm[]>([]);
  readonly archives = signal<ArchivedCharacter[]>([]);
  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = computed(() => this.notifications().filter(n => !n.readAt).length);
  readonly reviewDirty = signal(false);
  readonly builderDirty = signal(false);
  readonly adminDirty = signal(false);
  readonly mode = signal<'loading' | 'demo' | 'server'>('loading');
  readonly ready = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly storageError = signal(false);
  readonly activeId = signal('');
  readonly dirty = signal(false);
  readonly busy = signal(false);
  readonly active = computed(
    () => this.applications().find((a) => a.id === this.activeId()) ?? null,
  );
  readonly canOrganize = computed(
    () => this.mode() === 'demo' || this.user()?.role === 'organizer' || this.eventGrants().length > 0,
  );
  readonly canAdminEvents = computed(() => this.user()?.role === 'organizer' || this.eventGrants().some(g => g.role === 'organizer'));
  canManageForm(eventId: string) {
    return this.mode() === 'demo' || this.eventGrants().some(g => g.eventId === eventId && g.role === 'organizer');
  }
  isMember(eventId: string) {
    return this.mode() === 'demo' || this.memberships().some(m => m.eventId === eventId);
  }
  isCharacter(form: FormDefinition) {
    return this.mode() === 'demo' ? form.id === 'character-2027'
      : this.characterForms().some(m => m.eventId === form.eventId && m.formId === form.id);
  }
  canEdit(app: Application) {
    return !app.locked && app.status !== 'accepted' && (app.kind === 'character' || this.mode() === 'demo'
      || ['draft', 'changes'].includes(app.status));
  }
  private saveEndpoint(app: Application) { return app.kind === 'character' ? 'api/characters' : 'api/applications'; }
  private saveBody(app: Application) { return { ...app, expectedRevision: app.revision ?? 0 }; }
  async joinEvent(eventId: string) {
    if (this.mode() !== 'server' || this.isMember(eventId)) return;
    const membership = await this.request<EventMembership>(`api/events/${eventId}/join`, 'POST', {});
    this.memberships.update(all => [...all.filter(m => m.eventId !== eventId), membership]);
  }
  private initialized = false;
  private authEpoch = 0;
  private initialEvent: GameEvent | null = null;
  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const [seed, config] = await Promise.all([
        this.request<Seed>('data/platform.json'),
        this.request<{ mode: 'demo' | 'server' }>('runtime-config.json'),
      ]);
      this.seed.set(seed);
      this.initialEvent = structuredClone(seed.event);
      this.forms.set(seed.forms);
      this.mode.set(config.mode);
      if (config.mode === 'server') await this.refreshServer();
      else this.restoreDemo(seed);
      this.ready.set(true);
    } catch (e) {
      this.error.set(this.message(e));
    }
  }
  async request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(new URL(url, document.baseURI), {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response
      .json()
      .catch(() => ({ error: 'Nie udało się odczytać odpowiedzi serwera.' }));
    if (!response.ok) throw new Error(data.error ?? `Błąd serwera (${response.status}).`);
    return data as T;
  }
  async refreshServer() {
    const epoch = this.authEpoch;
    const data = await this.request<{
      forms: FormDefinition[];
      user: User | null;
      applications: Application[];
      events: GameEvent[];
      eventGrants: EventGrant[];
      memberships: EventMembership[];
      characterForms: CharacterForm[];
      characters: Application[];
      archives?: ArchivedCharacter[];
      notifications?: AppNotification[];
    }>('api/bootstrap');
    if (epoch !== this.authEpoch) return;
    this.forms.set(data.forms);
    this.user.set(data.user);
    this.events.set(data.events);
    this.eventGrants.set(data.eventGrants);
    this.memberships.set(data.memberships);
    this.characterForms.set(data.characterForms ?? []);
    this.archives.set(data.archives ?? []);
    this.notifications.set(data.notifications ?? []);
    const event = data.events.find(e => e.id === this.seed()?.event.id);
    if (event) this.seed.update(seed => seed ? { ...seed, event } : seed);
    const all = [...(data.characters ?? []), ...data.applications];
    if (!this.dirty()) {
      this.applications.set(all);
      this.activeId.set(all.some(a => a.id === this.activeId()) ? this.activeId() : all[0]?.id ?? '');
    }
  }
  private restoreDemo(seed: Seed) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (
          saved.version !== 1 ||
          !Array.isArray(saved.applications) ||
          !Array.isArray(saved.forms)
        )
          throw new Error('Invalid snapshot');
        if (
          saved.forms.some((f: FormDefinition) => definitionIssues(f).length) ||
          saved.applications.some(
            (a: Application) =>
              !a ||
              typeof a.id !== 'string' ||
              definitionIssues(a.form).length ||
              !a.answers ||
              typeof a.answers !== 'object',
          )
        )
          throw new Error('Invalid snapshot');
        this.forms.set(saved.forms);
        this.applications.set(saved.applications.map((a: Application) => {
          if (!this.isCharacter(a.form)) return a;
          const current = saved.forms.find((f: FormDefinition) => f.id === a.form.id);
          if (!current) return a;
          if (transformAnswers(a.form, current, a.answers).lostFieldIds.length) {
            this.error.set('Zapisana demonstracja wymaga ręcznego mapowania odpowiedzi do aktualnego formularza. Oryginalna kopia w przeglądarce pozostała nietknięta.');
            return a;
          }
          return { ...a, form: structuredClone(current) };
        }));
        this.activeId.set(saved.activeId);
        return;
      }
    } catch {
      this.notice.set('Nie udało się odczytać lokalnego szkicu. Załadowano bezpieczny przykład.');
    }
    const example: Application = {
      id: 'demo-alena',
      form: structuredClone(seed.forms[0]),
      answers: structuredClone(seed.example),
      status: 'draft',
      updatedAt: new Date().toISOString(),
    };
    // Import the previous generator without removing the original session backup.
    try {
      const old = JSON.parse(
        sessionStorage.getItem('ursunalia:character-generator:session:v1') ?? 'null',
      );
      if (old?.version === 1 && Array.isArray(old.characters)) {
        const migrated = old.characters
          .filter((c: any) => c && typeof c.name === 'string' && c.id !== 'demo-alena-ostrowidz')
          .map((c: any): Application => ({
            id: uid('migrated'),
            form: structuredClone(seed.forms[0]),
            status: 'draft',
            updatedAt: new Date().toISOString(),
            answers: {
              name: c.name,
              role: c.roleId ?? '',
              occupation: c.occupation ?? '',
              culture: c.cultureId ?? '',
              region: c.regionId ?? '',
              residency: c.residency ?? '',
              originDetail: c.originDetail ?? '',
              traits: c.traitIds ?? [],
              hooks: c.hookIds ?? [],
              history: c.story?.history ?? '',
              goal: c.story?.goal ?? '',
              obstacle: c.story?.obstacle ?? '',
              presenceReason: c.story?.presenceReason ?? '',
              stakes: c.story?.stakes ?? '',
              ...c.pillarRatings,
              gameStyle: c.gameplayStyle ?? '',
              openness: c.relationOpenness ?? '',
              boundaries: c.safetyBoundaries ?? '',
              exclusions: c.relationshipExclusions ?? '',
              relations: (c.relations ?? [])
                .map((r: any) => `${r.personOrCharacter}: ${r.description}`)
                .join('\n'),
            },
          }));
        this.applications.set([example, ...migrated]);
      }
    } catch {
      /* Old data remains untouched. */
    }
    if (!this.applications().length) this.applications.set([example]);
    this.activeId.set(example.id);
    this.persistDemo();
  }
  private persistDemo() {
    if (this.mode() !== 'demo') return;
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          forms: this.forms(),
          applications: this.applications(),
          activeId: this.activeId(),
        }),
      );
      this.storageError.set(false);
      this.dirty.set(false);
    } catch {
      this.storageError.set(true);
    }
  }
  open(id: string) {
    this.activeId.set(id);
    this.persistDemo();
  }
  start(form: FormDefinition): string | null {
    if (this.mode() === 'server' && !this.user()) {
      this.notice.set('Zaloguj się, aby zapisać zgłoszenie.');
      return null;
    }
    const existing = this.applications().find(
      (a) => a.id !== 'demo-alena' && (this.isCharacter(form)
        ? (a.kind === 'character' || (this.mode() === 'demo' && a.form.id === 'character-2027')) && a.form.eventId === form.eventId
        : a.form.id === form.id),
    );
    if (existing) {
      this.open(existing.id);
      return existing.id;
    }
    const a: Application = {
      id: uid('application'),
      form: structuredClone(form),
      answers: {},
      status: 'draft',
      kind: this.isCharacter(form) ? 'character' : 'survey',
      eventId: form.eventId,
      revision: 0,
      updatedAt: new Date().toISOString(),
    };
    this.applications.update((all) => [...all, a]);
    this.open(a.id);
    this.dirty.set(this.mode() === 'server');
    return a.id;
  }
  update(fieldId: string, value: Answers[string]) {
    const current = this.active();
    if (!current || !this.canEdit(current) || this.busy()) return;
    this.applications.update((all) =>
      all.map((a) =>
        a.id === current.id
          ? {
              ...a,
              answers: { ...a.answers, [fieldId]: value },
              updatedAt: new Date().toISOString(),
            }
          : a,
      ),
    );
    this.dirty.set(true);
    this.persistDemo();
  }
  async save() {
    const current = this.active();
    if (!current || this.busy() || !this.canEdit(current)) return;
    this.busy.set(true);
    try {
      if (this.mode() === 'server') {
        const saved = await this.request<Application>(this.saveEndpoint(current), 'POST', this.saveBody(current));
        this.replace(saved);
        this.dirty.set(false);
      } else this.persistDemo();
      this.notice.set(
        this.storageError()
          ? 'Zapis w przeglądarce jest niedostępny. Pobierz kopię JSON.'
          : 'Szkic został zapisany.',
      );
    } catch (e) {
      this.notice.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }
  async submit(): Promise<boolean> {
    const current = this.active();
    if (!current || this.busy() || !this.canEdit(current)) return false;
    if (Object.keys(answerIssues(current.form, current.answers)).length) {
      this.notice.set('Uzupełnij wymagane pola przed wysłaniem.');
      return false;
    }
    if (this.mode() === 'demo') {
      this.notice.set(
        'To wersja demonstracyjna. Zgłoszenie jest poprawne, ale nie zostało wysłane do organizatora. Możesz pobrać kopię JSON.',
      );
      return false;
    }
    this.busy.set(true);
    try {
      const saved = await this.request<Application>(this.saveEndpoint(current), 'POST', this.saveBody(current));
      this.replace(saved);
      this.dirty.set(false);
      const result = await this.request<Application>(
        `${this.saveEndpoint(saved)}/${saved.id}/submit`,
        'POST',
        { expectedRevision: saved.revision },
      );
      this.replace(result);
      this.dirty.set(false);
      this.notice.set('Zgłoszenie zostało wysłane do organizatora.');
      return true;
    } catch (e) {
      this.notice.set(this.message(e));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
  private replace(app: Application) {
    this.applications.update((all) => all.map((a) => (a.id === app.id ? app : a)));
  }
  async auth(mode: 'login' | 'register', name: string, email: string, password: string) {
    this.authEpoch++;
    await this.request(`api/auth/${mode}`, 'POST', { name, email, password });
    await this.refreshServer();
  }
  async logout() {
    this.authEpoch++;
    await this.request('api/auth/logout', 'POST', {});
    this.user.set(null);
    this.eventGrants.set([]);
    this.memberships.set([]);
    this.characterForms.set([]);
    this.archives.set([]);
    this.notifications.set([]);
    this.reviewDirty.set(false);
    this.adminDirty.set(false);
    this.events.set([]);
    this.forms.set([]);
    if (this.initialEvent) this.seed.update(seed => seed ? { ...seed, event: this.initialEvent! } : seed);
    this.applications.set([]);
    this.activeId.set('');
    this.dirty.set(false);
    await this.refreshServer();
  }
  async previewSchema(form: FormDefinition, expectedRevision: number): Promise<SchemaImpact> {
    if (this.mode() === 'server') return this.request<SchemaImpact>(`api/events/${form.eventId}/character-schema/preview`, 'POST', { definition: form, expectedRevision });
    const previous = this.forms().find(f => f.id === form.id) ?? form;
    const changes = schemaChanges(previous, form);
    const affected = this.applications().filter(a => a.form.id === form.id && transformAnswers(previous, form, a.answers).lostFieldIds.length);
    return { changes, destructive: changes.length > 0 || affected.length > 0,
      affectedCharacters: affected.length, affectedDeletedCharacters: 0,
      affectedAnswers: affected.reduce((n,a) => n + transformAnswers(previous, form, a.answers).lostFieldIds.length, 0), confirmationToken: 'demo' };
  }
  async saveSchema(form: FormDefinition, expectedRevision: number, confirmation?: SchemaImpact) {
    const errors = definitionIssues(form); if (errors.length) throw new Error(errors[0]);
    const previous = this.forms().find(f => f.id === form.id);
    let saved: FormDefinition;
    if (this.mode() === 'server') {
      saved = await this.request<FormDefinition>(`api/events/${form.eventId}/character-schema`, 'PUT',
        { definition: form, expectedRevision, confirmLoss: !!confirmation, confirmationToken: confirmation?.confirmationToken });
      this.notice.set('Zapisano formularz. Zmiany obowiązują wszystkie postacie wydarzenia.');
      // Refresh current schemas/characters only after successful commit. Preserve local work if the subsequent refresh fails.
      this.forms.update(all => [...all.filter(f => f.id !== saved.id), saved]);
      this.characterForms.update(all => [...all.filter(m => m.eventId !== saved.eventId), { eventId: saved.eventId, formId: saved.id, formRevision: saved.revision }]);
      if (!this.dirty()) {
        try { await this.refreshServer(); }
        catch { this.notice.set('Formularz zapisany. Odśwież postacie po odzyskaniu połączenia.'); }
      }
    } else {
      if ((previous?.revision ?? 0) !== expectedRevision) throw new Error('Konflikt rewizji formularza. Zachowaj swoją pracę.');
      const impact = await this.previewSchema(form, expectedRevision);
      if (impact.destructive && !confirmation) throw new Error('Potwierdź utratę odpowiedzi.');
      saved = { ...structuredClone(form), status: 'published', revision: expectedRevision + 1 };
      this.applications.update(all => all.map(a => a.form.id === saved.id ? { ...a, form: structuredClone(saved),
        answers: transformAnswers(a.form, saved, a.answers).answers, revision: (a.revision ?? 0) + 1 } : a));
      this.forms.update(all => [...all.filter(f => f.id !== saved.id), saved]);
      this.persistDemo();
    }
    return saved;
  }
  async exportSchema(eventId: string) {
    if (this.mode() === 'server') return this.request<unknown>(`api/events/${eventId}/character-schema/export`);
    const form = this.forms().find(f => f.eventId === eventId && this.isCharacter(f));
    return { format: 'ursunalia-character-schema-backup', formatVersion: 1, definition: form,
      characters: this.applications().filter(a => a.form.id === form?.id), gmNotes: [], gmNotesAvailable: false };
  }
  async refreshNotifications() {
    const owner = this.user()?.id;
    if (this.mode() === 'server' && owner) {
      const notifications = await this.request<AppNotification[]>('api/notifications');
      if (this.user()?.id === owner) this.notifications.set(notifications);
    }
  }
  async markRead(id: string) {
    const saved = await this.request<AppNotification>(`api/notifications/${id}/read`, 'POST', {});
    this.notifications.update(all => all.map(n => n.id === id ? saved : n));
  }
  async retireCharacter(app: { id: string; revision?: number }, archive: boolean) {
    if (this.mode() !== 'server') throw new Error('Ta operacja wymaga konta i serwera.');
    const owner = this.user()?.id;
    await this.request(`api/characters/${app.id}${archive ? '/archive' : ''}`, archive ? 'POST' : 'DELETE',
      { expectedRevision: app.revision, ...(archive ? { confirmArchive: true } : { confirmDelete: true }) });
    if (this.user()?.id !== owner) return;
    // Commit succeeded: discard only this character, including a possible unsaved local copy.
    this.applications.update(all => all.filter(a => a.id !== app.id));
    if (this.activeId() === app.id) { this.activeId.set(''); this.dirty.set(false); }
    this.archives.update(all => all.filter(a => a.id !== app.id));
    this.notice.set(archive ? 'Postać przeniesiona do archiwum. Zdjęcie usunięte.' : 'Postać i jej kopie wewnętrzne zostały usunięte.');
    try { const archives = await this.request<ArchivedCharacter[]>('api/archives'); if (this.user()?.id === owner) this.archives.set(archives); await this.refreshNotifications(); }
    catch { this.notice.set('Operacja wykonana. Odśwież konto po odzyskaniu połączenia.'); }
  }
  async reuseArchive(app: ArchivedCharacter, eventId: string) {
    if (this.dirty()) throw new Error('Zapisz bieżący szkic przed utworzeniem kolejnego.');
    const form = this.forms().find(f => f.eventId === eventId && this.isCharacter(f));
    if (!form) throw new Error('Wydarzenie nie ma formularza postaci.');
    await this.joinEvent(eventId);
    const owner = this.user()?.id;
    const saved = await this.request<Application>(`api/characters/${app.id}/reuse`, 'POST', { eventId, expectedSchemaRevision: form.revision });
    if (this.user()?.id !== owner) throw new Error('Konto zmieniło się. Odśwież własne postacie.');
    this.applications.update(all => [...all, saved]); this.open(saved.id);
    this.notice.set('Utworzono nowy szkic z pasujących odpowiedzi. Wymaga zwykłej weryfikacji MG.');
    return saved;
  }
  async openNotification(notification: AppNotification) {
    if (this.dirty()) throw new Error('Zapisz bieżące zmiany przed otwarciem innej postaci.');
    const owner = this.user()?.id;
    const character = await this.request<Application>(`api/characters/${notification.characterId}`);
    if (this.user()?.id !== owner) throw new Error('Konto zmieniło się. Odśwież własne postacie.');
    this.applications.update(all => [...all.filter(a => a.id !== character.id), character]);
    this.open(character.id); await this.markRead(notification.id);
  }
  message(e: unknown) {
    return e instanceof Error ? e.message : 'Operacja nie powiodła się. Spróbuj ponownie.';
  }
}
