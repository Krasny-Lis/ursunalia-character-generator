import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import type { TraitEntry } from '../../core/models/catalog.model';
import type { TraitCategoryEntry } from '../../core/models/catalog-data.model';
import { CatalogService } from '../../core/services/catalog.service';
import { CharacterStore } from '../../core/storage/character-store.service';

interface TraitGroup {
  category: TraitCategoryEntry;
  traits: TraitEntry[];
}

@Component({
  selector: 'app-traits-lab',
  imports: [RouterLink],
  templateUrl: './traits-lab.html',
  styleUrl: './traits-lab.scss',
})
export class TraitsLab {
  private readonly catalogService = inject(CatalogService);
  protected readonly charactersStore = inject(CharacterStore);
  protected readonly characters = this.charactersStore.characters;
  protected readonly activeCharacter = this.charactersStore.activeCharacter;
  protected readonly selectedIds = this.charactersStore.selectedTraitIds;

  protected createCharacter(): void {
    this.charactersStore.createCharacter();
  }

  protected selectCharacter(event: Event): void {
    const select = event.target as HTMLSelectElement | null;
    if (select) this.charactersStore.selectCharacter(select.value);
  }

  protected renameCharacter(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (input) this.charactersStore.renameActive(input.value);
  }

  protected readonly catalogs = toSignal(this.catalogService.catalogs$, {
    initialValue: null,
  });

  protected readonly groups = computed<TraitGroup[]>(() => {
    const data = this.catalogs();
    if (!data) return [];

    return [...data.traitCategories]
      .sort((a, b) => a.order - b.order)
      .map((category) => ({
        category,
        traits: data.traits.filter((trait) => trait.categoryId === category.id),
      }));
  });

  protected readonly selectedTraits = computed(() => {
    const data = this.catalogs();
    const chosen = new Set(this.selectedIds());
    return data?.traits.filter((trait) => chosen.has(trait.id)) ?? [];
  });

  protected isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  protected toggle(id: string): void {
    this.charactersStore.toggleTrait(id);
  }

  protected removeTrait(id: string): void {
    this.charactersStore.removeTrait(id);
  }

  protected scrollToTrait(id: string): void {
    document
      .getElementById(`trait-card-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected clearSelection(): void {
    this.charactersStore.clearTraits();
  }
}
