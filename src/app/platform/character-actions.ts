import { Component, inject, input, signal } from '@angular/core';
import { Application } from './models';
import { PlatformStore } from './platform.store';
@Component({
  selector: 'u-character-actions', standalone: true,
  styles: [`:host .button { white-space: normal; max-width: 100%; }`],
  template: `@if (store.mode() === 'server' && app().kind === 'character' && app().revision) {
    <div class="actions">
      <button class="button light" [disabled]="busy() || store.busy()" (click)="retire(true)">Archiwizuj postać</button>
      <button class="button light" [disabled]="busy() || store.busy()" (click)="retire(false)">Usuń postać</button>
    </div>
    @if (error()) { <p class="field-error" role="alert">{{ error() }}</p> }
  }`,
})
export class CharacterActions {
  readonly app = input.required<Application>();
  readonly store = inject(PlatformStore);
  readonly busy = signal(false);
  readonly error = signal('');
  async retire(archive: boolean) {
    if (this.busy() || this.store.busy()) return;
    const warning = archive
      ? 'Zarchiwizować postać? Zachowamy historyczną kopię tekstową bez zdjęcia. Zdjęcie zostanie usunięte z danych aplikacji. Nie będzie można edytować ani przywrócić tej postaci.'
      : 'Nieodwracalnie usunąć postać? Usuniemy treść, opis, zdjęcie oraz kopie wewnętrzne. MG nie będzie mógł jej przywrócić. Uczestnictwo w wydarzeniu pozostanie.';
    if (!window.confirm(warning + (this.store.dirty() && this.store.activeId() === this.app().id ? ' Niezapisane zmiany tej postaci zostaną odrzucone.' : ''))) return;
    this.busy.set(true); this.error.set('');
    try { await this.store.retireCharacter(this.app(), archive); }
    catch (e) { this.error.set(this.store.message(e)); }
    finally { this.busy.set(false); }
  }
}
