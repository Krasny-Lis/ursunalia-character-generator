import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import type { Character, GameplayStyle, PillarId, PillarRating, RelationOpenness } from '../../core/models/character.model';
import type { CatalogData } from '../../core/models/catalog-data.model';
import { CharacterStore } from '../../core/storage/character-store.service';

/** Edytor wydzielony z CharacterReview, bez zmiany modelu i sposobu zapisu. */
@Component({
  selector: 'app-character-preferences-editor',
  standalone: true,
  imports: [],
  templateUrl: './character-preferences-editor.html',
  styleUrl: '../character-review/character-review.scss',
  styles: [':host { display:block; min-height:0 !important; min-width:0; background:transparent !important; color:inherit; font:inherit; }'],
})
export class CharacterPreferencesEditor {
  protected readonly store = inject(CharacterStore);
  @Input({ required: true }) c!: Character;
  @Input({ required: true }) data!: CatalogData;
  
  @Input() highlightedField: string | null = null;
  @Input() activeInfoKey: string | null = null;
  @Output() readonly fieldTouched = new EventEmitter<string>();
  @Output() readonly infoRequested = new EventEmitter<{key: 'pillars' | 'gameStyles' | 'relationOpenness'; event: MouseEvent}>();

  
  protected readonly ratingScale = [1, 2, 3, 4, 5] as const;
  protected pillars() { return [...this.data.pillars].sort((a, b) => a.order - b.order); }
  protected requestInfo(key: 'pillars' | 'gameStyles' | 'relationOpenness', event: MouseEvent): void {
    this.infoRequested.emit({key,event});
  }
  protected ratingFor(id: string): number | null {
    return this.c.pillarRatings[id as PillarId] ?? null;
  }
  protected setRating(id: string, value: number): void {
    if (!this.data.pillars.some(p => p.id === id) || !Number.isInteger(value) || value < 1 || value > 5) return;
    const key = id as PillarId;
    const ratings = { ...this.c.pillarRatings };
    if (ratings[key] === value) delete ratings[key];
    else ratings[key] = value as PillarRating;
    this.store.updateActive({ pillarRatings: ratings });
  }
  protected toggleStyle(id: string): void {
    if (!this.data.gameStyles.some(item => item.id === id)) return;
    this.store.updateActive({ gameplayStyle: this.c.gameplayStyle === id ? null : id as GameplayStyle });
  }
  protected toggleOpenness(id: string): void {
    if (!this.data.relationOpenness.some(item => item.id === id)) return;
    this.store.updateActive({ relationOpenness: this.c.relationOpenness === id ? null : id as RelationOpenness });
  }
  protected changePrivate(field: 'safetyBoundaries' | 'relationshipExclusions', event: Event): void {
    this.store.updateActive({ [field]: (event.target as HTMLTextAreaElement).value });
  }

}
