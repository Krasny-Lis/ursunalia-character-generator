import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import type { PillarId } from '../../core/models/character.model';
import { CatalogService } from '../../core/services/catalog.service';
import { CharacterStore } from '../../core/storage/character-store.service';
import { validateCharacter } from '../../core/validation/character-validation';

/**
 * Tylko do odczytu: wszystkie informacje zgłoszenia i jego kompletność.
 * Edycja i lokalny szkic pozostają po stronie CharacterReview / CharacterStore.
 */
@Component({
  selector: 'app-character-summary',
  standalone: true,
  imports: [],
  templateUrl: './character-summary.html',
  // Podsumowanie korzysta z aktualnego design systemu kart i opisów.
  // Etap II: wydzielenie współdzielonych reguł do osobnego partiala SCSS.
  styleUrl: '../character-review/character-review.scss',
})
export class CharacterSummary {
  protected readonly store = inject(CharacterStore);
  protected readonly activeCharacter = this.store.activeCharacter;
  protected readonly catalogs = toSignal(inject(CatalogService).catalogs$, { initialValue: null });

  protected readonly role = computed(() =>
    this.catalogs()?.roles.find(entry => entry.id === this.activeCharacter()?.roleId));
  protected readonly region = computed(() =>
    this.catalogs()?.regions.find(entry => entry.id === this.activeCharacter()?.regionId));
  protected readonly culture = computed(() =>
    this.catalogs()?.cultures.find(entry => entry.id === this.activeCharacter()?.cultureId));
  protected readonly residency = computed(() =>
    this.catalogs()?.residencies.find(entry => entry.id === this.activeCharacter()?.residency));
  protected readonly selectedTraits = computed(() => {
    const c = this.activeCharacter();
    const data = this.catalogs();
    return c && data ? data.traits.filter(entry => c.traitIds.includes(entry.id)) : [];
  });
  protected readonly selectedHooks = computed(() => {
    const c = this.activeCharacter();
    const data = this.catalogs();
    return c && data ? data.hooks.filter(entry => c.hookIds.includes(entry.id)) : [];
  });
  protected readonly pillars = computed(() =>
    [...(this.catalogs()?.pillars ?? [])].sort((a, b) => a.order - b.order));
  protected readonly selectedStyle = computed(() =>
    this.catalogs()?.gameStyles.find(entry => entry.id === this.activeCharacter()?.gameplayStyle));
  protected readonly selectedOpenness = computed(() =>
    this.catalogs()?.relationOpenness.find(entry => entry.id === this.activeCharacter()?.relationOpenness));
  protected readonly validation = computed(() => {
    const c = this.activeCharacter();
    const data = this.catalogs();
    return c && data ? validateCharacter(c, data) : null;
  });
  protected readonly requiredSections = computed(() => this.validation()?.required ?? []);
  protected readonly readyCount = computed(() => this.validation()?.readyCount ?? 0);
  protected readonly allDescriptionsOpen = signal({ traits: false, hooks: false });
  protected readonly storyCollapsed = signal(false);

  protected ratingFor(id: string): number | null {
    return this.activeCharacter()?.pillarRatings?.[id as PillarId] ?? null;
  }

  protected toggleAllDescriptions(group: 'traits' | 'hooks'): void {
    this.allDescriptionsOpen.update(current => ({ ...current, [group]: !current[group] }));
  }

  protected toggleStory(): void {
    this.storyCollapsed.update(value => !value);
  }

  protected shortLabel(id: string, fullLabel: string): string {
    const labels: Record<string, string> = {
      name: 'Nazwa', role: 'Rola i zawód', region: 'Region', residency: 'Status',
      culture: 'Kultura', history: 'Biografia', pillars: '6 filarów', gameplay: 'Styl gry',
    };
    return labels[id] ?? fullLabel;
  }
}
