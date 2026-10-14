import { Injectable, signal, computed } from '@angular/core';
import { Answers, Application, FormDefinition, Seed, User, GameEvent, EventGrant, EventMembership } from './models';
import { answerIssues, definitionIssues } from '../../../shared/validation.mjs';
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
    () => this.mode() === 'demo' || this.eventGrants().length > 0,
  );
  canManageForm(eventId: string) {
    return this.mode() === 'demo' || this.eventGrants().some(g => g.eventId === eventId && g.role === 'organizer');
  }
  isMember(eventId: string) {
    return this.mode() === 'demo' || this.memberships().some(m => m.eventId === eventId);
  }
  async joinEvent(eventId: string) {
    if (this.mode() !== 'server' || this.isMember(eventId)) return;
    const membership = await this.request<EventMembership>(`api/events/${eventId}/join`, 'POST', {});
    this.memberships.update(all => [...all.filter(m => m.eventId !== eventId), membership]);
  }
  private initialized = false;
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
    const data = await this.request<{
      forms: FormDefinition[];
      user: User | null;
      applications: Application[];
      events: GameEvent[];
      eventGrants: EventGrant[];
      memberships: EventMembership[];
    }>('api/bootstrap');
    this.forms.set(data.forms);
    this.user.set(data.user);
    this.events.set(data.events);
    this.eventGrants.set(data.eventGrants);
    this.memberships.set(data.memberships);
    const event = data.events.find(e => e.id === this.seed()?.event.id);
    if (event) this.seed.update(seed => seed ? { ...seed, event } : seed);
    this.applications.set(data.applications);
    this.activeId.set(data.applications[0]?.id ?? '');
    this.dirty.set(false);
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
        this.applications.set(saved.applications);
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
      (a) => a.form.id === form.id && a.id !== 'demo-alena',
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
      updatedAt: new Date().toISOString(),
    };
    this.applications.update((all) => [...all, a]);
    this.open(a.id);
    this.dirty.set(this.mode() === 'server');
    return a.id;
  }
  update(fieldId: string, value: Answers[string]) {
    const current = this.active();
    if (!current || !['draft', 'changes'].includes(current.status)) return;
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
    if (!current || this.busy()) return;
    this.busy.set(true);
    try {
      if (this.mode() === 'server') {
        const saved = await this.request<Application>('api/applications', 'POST', current);
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
    if (!current || this.busy()) return false;
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
      const saved = await this.request<Application>('api/applications', 'POST', current);
      const result = await this.request<Application>(
        `api/applications/${saved.id}/submit`,
        'POST',
        {},
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
    await this.request(`api/auth/${mode}`, 'POST', { name, email, password });
    await this.refreshServer();
  }
  async logout() {
    await this.request('api/auth/logout', 'POST', {});
    this.user.set(null);
    this.eventGrants.set([]);
    this.memberships.set([]);
    this.events.set([]);
    this.forms.set([]);
    if (this.initialEvent) this.seed.update(seed => seed ? { ...seed, event: this.initialEvent! } : seed);
    this.applications.set([]);
    this.activeId.set('');
    this.dirty.set(false);
    await this.refreshServer();
  }
  async publish(form: FormDefinition) {
    const problems = definitionIssues(form);
    if (problems.length) throw new Error(problems[0]);
    let published: FormDefinition = {
      ...structuredClone(form),
      status: 'published',
      revision: (this.forms().find((f) => f.id === form.id)?.revision ?? 0) + 1,
    };
    if (this.mode() === 'server')
      published = await this.request<FormDefinition>('api/forms', 'POST', published);
    this.forms.update((all) => [...all.filter((f) => f.id !== published.id), published]);
    this.persistDemo();
    this.notice.set(
      this.mode() === 'demo'
        ? 'Ankieta opublikowana w tej przeglądarce. Zobaczysz ją na stronie wydarzenia.'
        : 'Ankieta opublikowana dla uczestników.',
    );
  }
  message(e: unknown) {
    return e instanceof Error ? e.message : 'Operacja nie powiodła się. Spróbuj ponownie.';
  }
}
