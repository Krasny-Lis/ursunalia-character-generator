import { Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { CharacterRelation, RelationOpenness } from '../../core/models/character.model';
import { CatalogService } from '../../core/services/catalog.service';
import { CharacterStore } from '../../core/storage/character-store.service';

@Component({
  selector: 'app-character-relations',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './character-relations.html',
  styleUrl: './character-relations.scss',
})
export class CharacterRelations {
  protected readonly store = inject(CharacterStore);
  private readonly catalogService = inject(CatalogService);

  protected readonly characters = this.store.characters;
  protected readonly activeCharacter = this.store.activeCharacter;
  protected readonly catalogs = toSignal(this.catalogService.catalogs$, { initialValue: null });
  protected readonly opennessOptions = computed(() => this.catalogs()?.relationOpenness ?? []);
  protected readonly selectedOpenness = computed(() => this.activeCharacter()?.relationOpenness ?? null);
  protected readonly selectedOpennessName = computed(() =>
    this.opennessOptions().find((option) => option.id === this.selectedOpenness())?.name ?? ''
  );
  protected readonly relations = computed(() => this.activeCharacter()?.relations ?? []);

  protected readonly newRelationForm = new FormGroup({
    personOrCharacter: new FormControl('', { nonNullable: true, validators: Validators.required }),
    description: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  protected readonly exclusionsControl = new FormControl('', { nonNullable: true });

  constructor() {
    // Nie resetujemy zawartości podczas wpisywania: efekt zależy tylko od activeId.
    effect(() => {
      const activeId = this.store.activeId();
      const character = untracked(() => this.store.activeCharacter());
      if (character?.id === activeId) {
        this.exclusionsControl.setValue(character.relationshipExclusions ?? '', { emitEvent: false });
        // Formularz nowej relacji jest szkicem i nie należy do poprzedniej postaci.
        this.newRelationForm.reset({ personOrCharacter: '', description: '' }, { emitEvent: false });
      }
    });

    this.exclusionsControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((relationshipExclusions) => {
      this.store.updateActive({ relationshipExclusions });
    });
  }

  protected get canAddRelation(): boolean {
    const { personOrCharacter, description } = this.newRelationForm.getRawValue();
    return !!this.activeCharacter() && !!personOrCharacter.trim() && !!description.trim();
  }

  protected addRelation(): void {
    if (!this.canAddRelation) return;
    const { personOrCharacter, description } = this.newRelationForm.getRawValue();
    const relation: CharacterRelation = {
      id: crypto.randomUUID(),
      personOrCharacter: personOrCharacter.trim(),
      description: description.trim(),
    };
    this.store.updateActive({ relations: [...this.relations(), relation] });
    this.newRelationForm.reset({ personOrCharacter: '', description: '' });
  }

  protected updateRelation(id: string, field: 'personOrCharacter' | 'description', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    if (!this.relations().some((relation) => relation.id === id)) return;
    this.store.updateActive({
      relations: this.relations().map((relation) =>
        relation.id === id ? { ...relation, [field]: value } : relation
      ),
    });
  }

  protected removeRelation(id: string): void {
    this.store.updateActive({ relations: this.relations().filter((relation) => relation.id !== id) });
  }

  protected toggleOpenness(id: string): void {
    if (!this.opennessOptions().some((option) => option.id === id)) return;
    const next: RelationOpenness | null = this.selectedOpenness() === id ? null : id as RelationOpenness;
    this.store.updateActive({ relationOpenness: next });
  }

  protected selectCharacter(event: Event): void {
    this.store.selectCharacter((event.target as HTMLSelectElement).value);
  }

  protected createCharacter(): void {
    this.store.createCharacter();
  }
}
