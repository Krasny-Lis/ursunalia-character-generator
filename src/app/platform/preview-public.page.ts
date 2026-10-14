import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

/** Transitional information page during the UI-first redesign, not fake published content. */
@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="paper ux-placeholder">
      <span class="eyebrow">Ursunalia 2027 · Projekt interfejsu</span>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
      <div class="ux-placeholder__notice">
        <strong>Widok w przygotowaniu</strong>
        <p>W pierwszym etapie sprawdzamy wspólną nawigację i układ strony.
          Zatwierdzona zawartość tego działu zostanie dodana w kolejnej części przebudowy.</p>
      </div>
      <a class="button light" routerLink="/">Wróć na stronę główną</a>
    </section>
  `,
})
export class PreviewPublicPage {
  private readonly route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.data['title'] as string;
  readonly description = this.route.snapshot.data['description'] as string;
}
