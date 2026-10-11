import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { PillarId } from '../../core/models/character.model';
import { CatalogService } from '../../core/services/catalog.service';
import { CharacterStore } from '../../core/storage/character-store.service';

interface RequiredSection {
  label: string;
  ready: boolean;
  route: string;
}

@Component({
  selector: 'app-character-review',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './character-review.html',
  styleUrl: './character-review.scss',
})
export class CharacterReview {
  protected readonly store = inject(CharacterStore);
  private readonly route = inject(ActivatedRoute);
  protected readonly cardMode = this.route.snapshot.data['cardMode'] === true;

  protected readonly characters = this.store.characters;
  protected readonly activeCharacter = this.store.activeCharacter;
  protected readonly catalogs = toSignal(inject(CatalogService).catalogs$, { initialValue: null });

  protected readonly role = computed(() =>
    this.catalogs()?.roles.find((entry) => entry.id === this.activeCharacter()?.roleId)
  );
  protected readonly region = computed(() =>
    this.catalogs()?.regions.find((entry) => entry.id === this.activeCharacter()?.regionId)
  );
  protected readonly culture = computed(() =>
    this.catalogs()?.cultures.find((entry) => entry.id === this.activeCharacter()?.cultureId)
  );
  protected readonly residency = computed(() =>
    this.catalogs()?.residencies.find((entry) => entry.id === this.activeCharacter()?.residency)
  );
  protected readonly selectedTraits = computed(() => {
    const c = this.activeCharacter();
    const data = this.catalogs();
    return c && data ? data.traits.filter((entry) => c.traitIds.includes(entry.id)) : [];
  });
  protected readonly selectedHooks = computed(() => {
    const c = this.activeCharacter();
    const data = this.catalogs();
    return c && data ? data.hooks.filter((entry) => c.hookIds.includes(entry.id)) : [];
  });
  protected readonly pillars = computed(() =>
    [...(this.catalogs()?.pillars ?? [])].sort((a, b) => a.order - b.order)
  );
  protected readonly selectedStyle = computed(() =>
    this.catalogs()?.gameStyles.find((entry) => entry.id === this.activeCharacter()?.gameplayStyle)
  );
  protected readonly selectedOpenness = computed(() =>
    this.catalogs()?.relationOpenness.find((entry) => entry.id === this.activeCharacter()?.relationOpenness)
  );

  // To jedynie wskaźnik gotowości formularza: nie wysyła ani nie zatwierdza zgłoszenia.
  protected readonly requiredSections = computed<RequiredSection[]>(() => {
    const c = this.activeCharacter();
    const data = this.catalogs();
    if (!c || !data) return [];
    return [
      { label: 'Nazwa postaci', ready: c.name.trim().length > 0, route: '/' },
      { label: 'Rola społeczna i zawód', ready: !!c.roleId && !!c.occupation.trim(), route: '/' },
      { label: 'Region pochodzenia', ready: !!c.regionId, route: '/' },
      { label: 'Status na Ziemiach Braci', ready: !!c.residency, route: '/' },
      { label: 'Pochodzenie kulturowe', ready: !!c.cultureId, route: '/' },
      { label: 'Biografia (min. 500 znaków)', ready: (c.story?.history?.trim().length ?? 0) >= 500, route: '/history' },
      {
        label: 'Oceny wszystkich sześciu filarów',
        ready: data.pillars.every((entry) => {
          const rating = c.pillarRatings?.[entry.id as PillarId];
          return typeof rating === 'number' && rating >= 1 && rating <= 5;
        }),
        route: '/pillars',
      },
      { label: 'Dominujący styl gry', ready: !!c.gameplayStyle, route: '/gameplay' },
    ];
  });
  protected readonly readyCount = computed(() => this.requiredSections().filter((entry) => entry.ready).length);

  protected selectCharacter(event: Event): void {
    this.store.selectCharacter((event.target as HTMLSelectElement).value);
  }

  protected createCharacter(): void {
    this.store.createCharacter();
  }

  protected ratingFor(id: string): number | null {
    return this.activeCharacter()?.pillarRatings?.[id as PillarId] ?? null;
  }
}
