import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import type { Character, CharacterStory } from '../../core/models/character.model';
import type { CatalogData } from '../../core/models/catalog-data.model';
import { CharacterStore } from '../../core/storage/character-store.service';

/** Edytor wydzielony z CharacterReview, bez zmiany modelu i sposobu zapisu. */
@Component({
  selector: 'app-character-story-editor',
  standalone: true,
  imports: [],
  templateUrl: './character-story-editor.html',
  styleUrl: '../character-review/character-review.scss',
  styles: [':host { display:block; min-height:0 !important; min-width:0; background:transparent !important; color:inherit; font:inherit; }'],
})
export class CharacterStoryEditor {
  protected readonly store = inject(CharacterStore);
  @Input({ required: true }) c!: Character;
  @Input({ required: true }) data!: CatalogData;
  
  @Input() highlightedField: string | null = null;
  @Output() readonly fieldTouched = new EventEmitter<string>();

  
  protected changeStory(field: keyof CharacterStory, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.store.updateActive({ story: { ...this.c.story, [field]: value } });
  }

}
