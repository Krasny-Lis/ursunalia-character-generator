import { Component, Input, inject, signal } from '@angular/core';
import type { Character } from '../../core/models/character.model';
import type { CatalogData } from '../../core/models/catalog-data.model';
import { CharacterStore } from '../../core/storage/character-store.service';

/** Edytor wydzielony z CharacterReview, bez zmiany modelu i sposobu zapisu. */
@Component({
  selector: 'app-character-catalog-editor',
  standalone: true,
  imports: [],
  templateUrl: './character-catalog-editor.html',
  styleUrl: '../character-review/character-review.scss',
  styles: [':host { display:block; min-height:0 !important; min-width:0; background:transparent !important; color:inherit; font:inherit; }'],
})
export class CharacterCatalogEditor {
  protected readonly store = inject(CharacterStore);
  @Input({ required: true }) c!: Character;
  @Input({ required: true }) data!: CatalogData;
  
  @Input({ required: true }) kind!: 'traits' | 'hooks';
  @Input({ required: true }) selected!: ReadonlyArray<{ id: string; name: string }>;

  
  protected readonly allDescriptionsOpen = signal(false);
  protected toggleAllDescriptions(): void { this.allDescriptionsOpen.update(value => !value); }

  protected scrollToCatalogItem(id: string): void {
    if (typeof document === 'undefined') return;
    const row = document.getElementById(`${this.kind}-option-${id}`);
    if (!row) return;
    const description = row.querySelector('details');
    if (description) description.open = true;
    const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

}
