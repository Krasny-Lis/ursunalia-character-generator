import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { PillarId, PillarRating } from '../../core/models/character.model';
import { CatalogService } from '../../core/services/catalog.service';
import { CharacterStore } from '../../core/storage/character-store.service';

@Component({
  selector: 'app-character-pillars',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './character-pillars.html',
  styleUrl: './character-pillars.scss',
})
export class CharacterPillars {
  protected readonly store = inject(CharacterStore);
  private readonly catalogsService = inject(CatalogService);

  protected readonly characters = this.store.characters;
  protected readonly activeCharacter = this.store.activeCharacter;
  protected readonly catalogs = toSignal(this.catalogsService.catalogs$, {
    initialValue: null,
  });

  protected readonly pillars = computed(() =>
    [...(this.catalogs()?.pillars ?? [])].sort((a, b) => a.order - b.order)
  );
  protected readonly scores = [1, 2, 3, 4, 5] as const;
  protected readonly ratedCount = computed(() =>
    this.pillars().filter((pillar) => this.ratingFor(pillar.id) !== null).length
  );

  protected ratingFor(id: string): PillarRating | null {
    return this.activeCharacter()?.pillarRatings?.[id as PillarId] ?? null;
  }

  protected ratePillar(id: string, rating: PillarRating): void {
    // Nie zapisuj ocen nieznanych filarów ani wartości spoza skali 1–5.
    if (!this.pillars().some((pillar) => pillar.id === id) || rating < 1 || rating > 5) return;
    const character = this.activeCharacter();
    if (!character) return;
    // Ponowne kliknięcie tej samej oceny odznacza ją.
    if (this.ratingFor(id) === rating) {
      this.clearRating(id);
      return;
    }
    this.store.updateActive({
      pillarRatings: { ...character.pillarRatings, [id]: rating },
    });
  }

  protected clearRating(id: string): void {
    const character = this.activeCharacter();
    if (!character) return;
    const ratings = { ...character.pillarRatings };
    delete ratings[id as PillarId];
    this.store.updateActive({ pillarRatings: ratings });
  }

  protected selectCharacter(event: Event): void {
    this.store.selectCharacter((event.target as HTMLSelectElement).value);
  }

  protected createCharacter(): void {
    this.store.createCharacter();
  }

  protected scrollToPillar(id: string): void {
    document.getElementById(`pillar-${id}`)?.scrollIntoView({
      behavior: 'smooth', block: 'start',
    });
  }
}
