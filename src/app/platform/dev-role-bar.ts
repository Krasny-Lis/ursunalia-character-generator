import { Component, inject } from '@angular/core';
import { UiPreviewStore } from './ui-preview.store';

@Component({
  selector: 'app-dev-role-bar',
  standalone: true,
  template: `
    @if (preview.enabled) {
      <aside class="dev-role-bar" aria-label="Roboczy podgląd ról i stanów">
        <div class="dev-role-bar__top">
          <div class="dev-role-bar__heading">
            <strong>Podgląd UI</strong>
            <span>Wyłącznie demonstracja — bez zmiany rzeczywistych uprawnień i danych</span>
          </div>
          <button type="button" class="dev-role-bar__toggle"
            [attr.aria-expanded]="!preview.collapsed()"
            (click)="preview.collapsed.set(!preview.collapsed())">
            {{ preview.collapsed() ? 'Rozwiń podgląd' : 'Zwiń podgląd' }}
          </button>
        </div>
        @if (!preview.collapsed()) {
          <div class="dev-role-bar__controls">
            <label>Rola
              <select aria-label="Podgląd roli" [value]="preview.role()"
                (change)="preview.setRole($any($event.target).value)">
                <option value="guest">Gość</option>
                <option value="player">Gracz</option>
                <option value="gm">Mistrz Gry</option>
                <option value="organizer">Organizator</option>
              </select>
            </label>
            @if (preview.role() !== 'guest') {
              <label>Postać
                <select aria-label="Podgląd statusu postaci" [value]="preview.character()"
                  (change)="preview.setCharacter($any($event.target).value)">
                  <option value="none">Brak postaci</option>
                  <option value="draft">W edycji</option>
                  <option value="submitted">Do weryfikacji</option>
                  <option value="changes">Do poprawy</option>
                  <option value="rejected">Odrzucona</option>
                  <option value="accepted">Zaakceptowana</option>
                </select>
              </label>
              <label class="dev-role-bar__check">
                <input type="checkbox" [checked]="preview.locked()"
                  (change)="preview.locked.set($any($event.target).checked)" />
                Zablokowana
              </label>
              <label>Składka
                <select aria-label="Podgląd statusu składki" [value]="preview.payment()"
                  (change)="preview.setPayment($any($event.target).value)">
                  <option value="unavailable">Niedostępna</option>
                  <option value="unpaid">Nieopłacona</option>
                  <option value="paid">Opłacona</option>
                </select>
              </label>
              <label>Dokument
                <select aria-label="Podgląd statusu karty" [value]="preview.card()"
                  (change)="preview.setCard($any($event.target).value)">
                  <option value="preparing">W przygotowaniu</option>
                  <option value="review">Do sprawdzenia</option>
                  <option value="ready">Gotowa</option>
                </select>
              </label>
              <label class="dev-role-bar__check">
                <input type="checkbox" [checked]="preview.hasCardLink()"
                  (change)="preview.hasCardLink.set($any($event.target).checked)" />
                Jest link
              </label>
              <span class="dev-role-bar__result" aria-live="polite">
                Karta: {{ preview.canViewCard() ? 'dostępna w podglądzie' : 'niedostępna' }}
              </span>
            }
          </div>
        }
      </aside>
    }
  `,
})
export class DevRoleBar {
  readonly preview = inject(UiPreviewStore);
}
