import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Icon } from './icon';
import { PlatformStore } from './platform.store';
import { UiPreviewStore } from './ui-preview.store';
import type { EventAdministration } from './models';

type AdminTab = 'overview' | 'participants' | 'characters' | 'payments' |
  'documents' | 'content' | 'builder' | 'settings';

@Component({
  standalone: true,
  imports: [RouterLink, Icon, DatePipe],
  templateUrl: './organizer-hub.page.html',
  styleUrl: './organizer-hub.page.scss',
})
export class OrganizerHubPage {
  readonly store = inject(PlatformStore);
  readonly preview = inject(UiPreviewStore);
  private readonly route = inject(ActivatedRoute);
  readonly items: readonly { id: AdminTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Pulpit', icon: 'grid' },
    { id: 'participants', label: 'Uczestnicy', icon: 'people' },
    { id: 'characters', label: 'Postacie', icon: 'feather' },
    { id: 'payments', label: 'Składki', icon: 'file' },
    { id: 'documents', label: 'Karty postaci', icon: 'book' },
    { id: 'content', label: 'Treści strony', icon: 'edit' },
    { id: 'builder', label: 'Kreator postaci', icon: 'list' },
    { id: 'settings', label: 'Ustawienia', icon: 'shield' },
  ];
  readonly tab = signal<AdminTab>(this.initialTab());
  readonly participants = signal<EventAdministration | null>(null);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly query = signal('');
  readonly selectedParticipant = signal<string | null>(null);
  readonly demoPaid = signal(false);
  readonly demoCard = signal<'preparing' | 'review' | 'ready'>('preparing');
  readonly demoHasLink = signal(false);
  readonly cmsKind = signal<'world' | 'news'>('world');
  readonly cmsVisibility = signal<'organizer' | 'everyone'>('organizer');
  readonly cmsTitle = signal('');
  readonly cmsSummary = signal('');
  readonly cmsBody = signal('');

  readonly isUrsunaliaOrganizer = computed(() =>
    this.store.user()?.role === 'organizer' ||
    this.store.eventGrants().some(g => g.eventId === 'ursunalia-2027' && g.role === 'organizer'));
  readonly canAccess = computed(() => this.isUrsunaliaOrganizer() ||
    (this.store.mode() === 'demo' && this.preview.enabled && this.preview.role() === 'organizer'));
  readonly demo = computed(() => this.store.mode() === 'demo' && this.preview.enabled);
  readonly listed = computed(() => {
    const q = this.query().trim().toLocaleLowerCase('pl');
    return (this.participants()?.participants ?? []).filter(p =>
      !q || [p.name, p.email].some(value => value.toLocaleLowerCase('pl').includes(q)));
  });
  readonly selected = computed(() =>
    (this.participants()?.participants ?? []).find(p => p.id === this.selectedParticipant()) ?? null);
  readonly event = computed(() => this.store.events().find(e => e.id === 'ursunalia-2027')
    ?? this.store.seed()?.event ?? null);
  readonly cmsPreview = computed(() => this.cmsBody().split(/\n\n+/).map(x => x.trim()).filter(Boolean));

  constructor() {
    effect(() => {
      if (this.store.ready() && this.store.mode() === 'server' &&
          this.isUrsunaliaOrganizer() && !this.loaded()) void this.refresh();
    });
  }

  private initialTab(): AdminTab {
    const param = this.route.snapshot.queryParamMap.get('tab');
    return (['overview','participants','characters','payments','documents','content','builder','settings'] as const)
      .find(value => value === param) ?? 'overview';
  }
  select(tab: AdminTab) { this.tab.set(tab); }

  async refresh() {
    if (!this.isUrsunaliaOrganizer() || this.store.mode() !== 'server' || this.loading()) return;
    this.loading.set(true);
    this.loaded.set(true);
    this.error.set('');
    try {
      const data = await this.store.request<EventAdministration>('api/events/ursunalia-2027/administration');
      if (!this.isUrsunaliaOrganizer()) return;
      this.participants.set(data);
    } catch (e) {
      this.error.set(this.store.message(e));
    } finally {
      this.loading.set(false);
    }
  }

  changeKind(value: string) { if (value === 'world' || value === 'news') this.cmsKind.set(value); }
  changeVisibility(value: string) {
    if (value === 'organizer' || value === 'everyone') this.cmsVisibility.set(value);
  }
}
