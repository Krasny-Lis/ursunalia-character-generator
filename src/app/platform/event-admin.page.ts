import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PlatformStore } from './platform.store';
import { EventAdministration, EventAccount, GameEvent, ManagedCharacter, statusLabel } from './models';
import { Icon } from './icon';
const emptyEvent = (): GameEvent => ({ id: '', name: '', subtitle: '', date: '', location: '', locationNote: '', description: '', status: 'Zapisy zamknięte', published: false, registrationsOpen: false });
@Component({
  standalone: true, imports: [FormsModule, RouterLink, DatePipe, Icon], templateUrl: './event-admin.page.html',
  styles: [`:host .button { white-space: normal; max-width: 100%; } :host .info-strip { flex-wrap: wrap; } :host .survey-card p { max-width: none; overflow-wrap: anywhere; }`],
})
export class EventAdminPage {
  readonly store = inject(PlatformStore);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly data = signal<EventAdministration | null>(null);
  readonly characters = signal<ManagedCharacter[]>([]);
  readonly selected = signal(new Set<string>());
  readonly accounts = signal<EventAccount[]>([]);
  readonly status = statusLabel;
  event = emptyEvent();
  eventId = '';
  query = '';
  completed = false;
  constructor() { this.eventId = this.managed()[0]?.id ?? ''; if (this.eventId) void this.load(); }
  managed() { return this.store.events().filter(e => this.store.canManageForm(e.id)); }
  canCreate() { return this.store.mode() === 'server' && this.store.user()?.role === 'organizer'; }
  changed() { this.store.adminDirty.set(true); }
  canLeave() { return !this.store.adminDirty() || window.confirm('Masz niezapisane dane wydarzenia. Odrzucić zmiany?'); }
  ngOnDestroy() { this.store.adminDirty.set(false); }
  chooseEvent(id: string) {
    if (this.busy() || !this.canLeave()) return;
    this.store.adminDirty.set(false); this.eventId = id; this.data.set(null); this.characters.set([]); this.event = emptyEvent();
    void this.load();
  }
  async load() {
    if (this.busy() || !this.canLeave()) return;
    if (!this.eventId) { this.event = emptyEvent(); this.data.set(null); this.characters.set([]); this.selected.set(new Set()); this.accounts.set([]); this.store.adminDirty.set(false); return; }
    this.busy.set(true); this.error.set('');
    try { await this.reload(); }
    catch (e) { this.error.set(this.store.message(e)); }
    finally { this.busy.set(false); }
  }
  private async reload() {
    const [data, characters] = await Promise.all([
      this.store.request<EventAdministration>(`api/events/${this.eventId}/administration`),
      this.store.request<ManagedCharacter[]>(`api/events/${this.eventId}/characters`),
    ]);
    this.data.set(data); this.event = structuredClone(data.event); this.characters.set(characters);
    this.selected.set(new Set()); this.accounts.set([]); this.completed = false;
    this.store.events.update(all => [...all.filter(e => e.id !== data.event.id), data.event]);
    this.store.adminDirty.set(false);
  }
  async save() {
    if (this.busy() || this.store.mode() !== 'server') return;
    this.busy.set(true); this.error.set('');
    try {
      const { id, name, subtitle, date, location, locationNote, description, published, registrationsOpen } = this.event;
      const saved = await this.store.request<GameEvent>(`api/events${this.eventId ? '/' + this.eventId : ''}`, this.eventId ? 'PATCH' : 'POST',
        { ...(this.eventId ? { expectedRevision: this.event.revision } : { id }), name, subtitle, date, location, locationNote, description, published, registrationsOpen });
      this.eventId = saved.id; this.event = saved; this.store.adminDirty.set(false);
      this.store.events.update(all => [...all.filter(e => e.id !== saved.id), saved]);
      this.store.eventGrants.update(all => [...all.filter(g => g.eventId !== saved.id), { eventId: saved.id, role: 'organizer' }]);
      this.store.notice.set('Zapisano wydarzenie.');
      await this.reload();
    } catch (e) { this.error.set(this.store.message(e)); }
    finally { this.busy.set(false); }
  }
  async search() {
    if (!this.eventId || this.busy()) return;
    this.busy.set(true); this.error.set(''); this.accounts.set([]);
    try { this.accounts.set(await this.store.request<EventAccount[]>(`api/events/${this.eventId}/accounts?q=${encodeURIComponent(this.query.trim())}`)); }
    catch (e) { this.error.set(this.store.message(e)); }
    finally { this.busy.set(false); }
  }
  async grant(account: EventAccount, role?: 'organizer' | 'gm') {
    if (this.busy() || this.store.adminDirty()) return;
    if (!role && !window.confirm(`Odebrać uprawnienia kontu ${account.name} w tym wydarzeniu?`)) return;
    this.busy.set(true); this.error.set('');
    try {
      await this.store.request(`api/events/${this.eventId}/grants/${account.id}`, role ? 'PUT' : 'DELETE', { role, expectedRevision: this.event.revision });
      this.store.notice.set('Zmieniono uprawnienia wydarzenia.');
      // Revocation applies immediately, including when the organizer revokes their own grant.
      const bootstrap = await this.store.request<{ eventGrants: { eventId: string; role: 'organizer' | 'gm' }[] }>('api/bootstrap');
      this.store.eventGrants.set(bootstrap.eventGrants);
      if (this.store.canManageForm(this.eventId)) await this.reload();
      else {
        this.data.set(null); this.characters.set([]); this.accounts.set([]); this.selected.set(new Set());
        this.event = emptyEvent(); this.eventId = this.managed()[0]?.id ?? '';
        if (this.eventId) await this.reload();
      }
    } catch (e) { this.error.set(this.store.message(e)); }
    finally { this.busy.set(false); }
  }
  toggle(id: string, checked: boolean) { this.selected.update(all => { const next = new Set(all); checked ? next.add(id) : next.delete(id); return next; }); }
  selectAll(checked: boolean) { this.selected.set(new Set(checked ? this.characters().map(c => c.id) : [])); }
  async operate(archive: boolean, locked = true, single?: ManagedCharacter) {
    if (this.busy() || this.store.adminDirty()) return;
    const selected = single ? [single] : this.characters().filter(c => this.selected().has(c.id));
    if (!selected.length) return;
    if (archive && (!this.completed || !window.confirm(`Zarchiwizować ${selected.length} postaci po zakończeniu wydarzenia? Zachowamy tylko historyczny tekst, usuniemy zdjęcia. Nie będzie można przywrócić postaci.`))) return;
    this.busy.set(true); this.error.set('');
    try {
      await this.store.request(`api/events/${this.eventId}/${archive ? 'character-archives' : 'character-locks'}`, 'POST',
        { characters: selected.map(c => ({ id: c.id, expectedRevision: c.revision })), ...(archive
          ? { confirmArchive: true, confirmCompleted: this.completed, expectedEventRevision: this.event.revision } : { locked }) });
      this.store.notice.set(archive ? 'Zarchiwizowano wskazane postacie bez zdjęć.' : locked ? 'Karty zablokowane.' : 'Karty odblokowane. Statusy weryfikacji pozostają bez zmian.');
      await this.reload();
    } catch (e) { this.error.set(this.store.message(e)); }
    finally { this.busy.set(false); }
  }
}
