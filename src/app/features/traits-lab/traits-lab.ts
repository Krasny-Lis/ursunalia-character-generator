import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import type { TraitEntry } from '../../core/models/catalog.model';
import type { TraitCategoryEntry } from '../../core/models/catalog-data.model';
import { CatalogService } from '../../core/services/catalog.service';

interface TraitGroup {
  category: TraitCategoryEntry;
  traits: TraitEntry[];
}

@Component({
  selector: 'app-traits-lab',
  imports: [],
  templateUrl: './traits-lab.html',
  styleUrl: './traits-lab.scss',
})
export class TraitsLab {
  private readonly catalogService = inject(CatalogService);

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

  protected readonly selectedIds = signal<string[]>([]);
  protected readonly selectedTraits = computed(() => {
    const data = this.catalogs();
    const chosen = new Set(this.selectedIds());
    return data?.traits.filter((trait) => chosen.has(trait.id)) ?? [];
  });

  protected isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  protected toggle(id: string): void {
    this.selectedIds.update((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  protected removeTrait(id: string): void {
    this.selectedIds.update((current) => current.filter((item) => item !== id));
  }

  protected scrollToTrait(id: string): void {
    document
      .getElementById(`trait-card-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected clearSelection(): void {
    this.selectedIds.set([]);
  }
}
