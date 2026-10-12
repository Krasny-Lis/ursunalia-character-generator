import { Component, Input, inject, signal, effect, untracked } from '@angular/core';
import type { Character } from '../../core/models/character.model';
import type { CatalogData } from '../../core/models/catalog-data.model';
import { CharacterStore } from '../../core/storage/character-store.service';

/** Edytor wydzielony z CharacterReview, bez zmiany modelu i sposobu zapisu. */
@Component({
  selector: 'app-character-relations-editor',
  standalone: true,
  imports: [],
  templateUrl: './character-relations-editor.html',
  styleUrl: '../character-review/character-review.scss',
  styles: [':host { display:block; min-height:0 !important; min-width:0; background:transparent !important; color:inherit; font:inherit; }'],
})
export class CharacterRelationsEditor {
  protected readonly store = inject(CharacterStore);
  @Input({ required: true }) c!: Character;
  @Input({ required: true }) data!: CatalogData;
  
  
  protected readonly relationPerson = signal('');
  protected readonly relationDescription = signal('');
  constructor() {
    // Zachowanie dotychczasowe: po przełączeniu testowej postaci zerujemy niesfinalizowaną znajomość.
    effect(() => {
      this.store.activeId();
      untracked(() => { this.relationPerson.set(''); this.relationDescription.set(''); });
    });
  }
  protected updateRelation(id: string, field: 'personOrCharacter' | 'description', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.store.updateActive({ relations: this.c.relations.map(item => item.id === id ? { ...item, [field]: value } : item) });
  }
  protected addRelation(): void {
    const personOrCharacter = this.relationPerson().trim();
    const description = this.relationDescription().trim();
    if (!personOrCharacter || !description) return;
    this.store.updateActive({ relations: [...this.c.relations, { id: crypto.randomUUID(), personOrCharacter, description }] });
    this.relationPerson.set('');
    this.relationDescription.set('');
  }
  protected removeRelation(id: string): void {
    this.store.updateActive({ relations: this.c.relations.filter(item => item.id !== id) });
  }

}
