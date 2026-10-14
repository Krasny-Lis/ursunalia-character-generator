import { Injectable, computed, inject } from '@angular/core';
import { PlatformStore } from './platform.store';
import { UiPreviewStore, type PreviewCharacter } from './ui-preview.store';
import { statusLabel, type Application } from './models';

/**
 * Shared read-only UI projection for Ursunalia 2027.
 * The developer preview never grants privileges, writes to the API or creates
 * an actual payment / Google Docs link.
 */
@Injectable({ providedIn: 'root' })
export class ParticipantViewStore {
  readonly store = inject(PlatformStore);
  readonly preview = inject(UiPreviewStore);
  readonly simulated = computed(() => this.preview.enabled && this.preview.role() === 'player');
  readonly hasAccount = computed(() => this.simulated() || !!this.store.user());

  readonly character = computed<Application | null>(() => {
    const found = this.store.applications().filter(app =>
      app.form.eventId === 'ursunalia-2027' &&
      (app.kind === 'character' || (this.store.mode() === 'demo' && app.form.id === 'character-2027')),
    );
    return found.find(app => app.id !== 'demo-alena')
      ?? found.find(app => app.id === this.store.activeId())
      ?? found[0] ?? null;
  });

  readonly status = computed<PreviewCharacter>(() =>
    this.simulated() ? this.preview.character() : this.character()?.status ?? 'none',
  );
  readonly hasCharacter = computed(() => this.status() !== 'none');
  readonly locked = computed(() =>
    this.simulated() ? this.preview.locked() : !!this.character()?.locked,
  );
  readonly accepted = computed(() => this.status() === 'accepted');

  readonly statusLabel = computed(() =>
    this.status() === 'none' ? 'Brak zgłoszenia' : statusLabel(this.status()),
  );

  readonly characterDetail = computed(() => {
    if (!this.hasCharacter()) return 'Utwórz zgłoszenie swojej postaci.';
    if (this.locked()) return 'Zgłoszenie zablokowane przez organizatora.';
    switch (this.status()) {
      case 'draft': return 'Szkic nie został jeszcze wysłany do MG.';
      case 'submitted': return 'Zgłoszenie czeka na sprawdzenie przez MG.';
      case 'changes': return 'MG poprosił o wprowadzenie poprawek.';
      case 'rejected': return 'Zgłoszenie zostało odrzucone.';
      case 'accepted': return 'Postać zaakceptowana przez MG.';
    }
  });

  readonly payment = computed(() => {
    if (!this.accepted()) return { title: 'Zablokowana', detail: 'Dane składki pojawią się po akceptacji postaci.' };
    if (!this.simulated()) return { title: 'W przygotowaniu', detail: 'Obsługa danych do przelewu i potwierdzeń zostanie podłączona w późniejszym etapie.' };
    if (this.preview.payment() === 'paid') return { title: 'Opłacona (symulacja)', detail: 'W podglądzie organizator potwierdził składkę. To nie jest prawdziwa wpłata.' };
    if (this.preview.payment() === 'unpaid') return { title: 'Nieopłacona (symulacja)', detail: 'Dane przelewu nie zostały udostępnione; status służy jedynie sprawdzeniu UI.' };
    return { title: 'Dane w przygotowaniu', detail: 'W wersji demonstracyjnej składka nie została jeszcze udostępniona.' };
  });

  readonly card = computed(() => {
    if (!this.accepted()) return { title: 'Zablokowana', detail: 'Najpierw potrzebna jest akceptacja MG i potwierdzenie składki.' };
    if (!this.simulated()) return { title: 'W przygotowaniu', detail: 'Łączenie kart postaci z Google Docs będzie dodane w osobnym etapie.' };
    if (this.preview.payment() !== 'paid') return { title: 'Oczekuje na składkę', detail: 'Potwierdzenie składki jest warunkiem udostępnienia karty.' };
    if (this.preview.card() === 'preparing') return { title: 'W przygotowaniu', detail: 'W symulacji organizator nie przygotował jeszcze dokumentu.' };
    if (!this.preview.hasCardLink()) return { title: 'Brak linku do dokumentu', detail: 'W podglądzie karta nie ma przypisanego linku Google Docs.' };
    return { title: this.preview.card() === 'review' ? 'Do sprawdzenia (symulacja)' : 'Gotowa (symulacja)',
      detail: 'Warunki dostępu są spełnione w podglądzie. Żaden prawdziwy dokument Google Docs nie został przypisany.' };
  });

  readonly form = computed(() =>
    this.store.forms().find(form =>
      form.eventId === 'ursunalia-2027' && form.status === 'published' && this.store.isCharacter(form),
    ) ?? null,
  );
  readonly canStart = computed(() => !!this.form() &&
    (this.store.mode() === 'demo' ||
      this.store.events().some(event => event.id === 'ursunalia-2027' && event.registrationsOpen === true)));

  /**
   * Draft/decision rights remain governed by the real PlatformStore.
   * Even when the preview says "unlocked", actual locked records stay locked.
   */
  canEditRecord(app: Application | null): boolean {
    return !!app && this.hasCharacter() && !this.locked() && this.status() !== 'accepted' &&
      this.store.canEdit(app) && this.hasAccount();
  }
}
