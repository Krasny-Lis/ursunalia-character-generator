import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Application, statusLabel } from './models';
@Component({
  selector: 'u-character-history', standalone: true, imports: [DatePipe],
  template: `@if (app().kind === 'character') {
    <section class="paper">
      <h3>Historia decyzji MG</h3>
      @if (app().migrated) { <p>Stan zastany z dawnego zgłoszenia. Dawny aktor i czas decyzji nie są znane.</p> }
      @for (entry of app().history ?? []; track entry.id) {
        <p><strong>{{ entry.actorName }}</strong> · {{ entry.decidedAt | date: 'dd.MM.yyyy, HH:mm' }}<br />
          {{ entry.action === 'unlock' ? 'Odblokowanie' : 'Decyzja' }}: {{ status(entry.fromStatus) }} → {{ status(entry.status) }}
          @if (entry.comment) { <br />{{ entry.comment }} }
        </p>
      } @empty { <p>Brak nowych decyzji MG.</p> }
    </section>
  }`,
})
export class CharacterHistory {
  readonly app = input.required<Application>();
  readonly status = statusLabel;
}
