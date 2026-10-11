import { Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { GameplayStyle } from '../../core/models/character.model';
import { CatalogService } from '../../core/services/catalog.service';
import { CharacterStore } from '../../core/storage/character-store.service';

@Component({
  selector: 'app-character-gameplay',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './character-gameplay.html',
  styleUrl: './character-gameplay.scss',
})
export class CharacterGameplay {
  protected readonly store = inject(CharacterStore);
  private readonly catalogService = inject(CatalogService);

  protected readonly characters = this.store.characters;
  protected readonly activeCharacter = this.store.activeCharacter;
  protected readonly catalogs = toSignal(this.catalogService.catalogs$, { initialValue: null });
  protected readonly styles = computed(() => this.catalogs()?.gameStyles ?? []);
  protected readonly selectedStyle = computed(() => this.activeCharacter()?.gameplayStyle ?? null);
  protected readonly selectedStyleName = computed(() =>
    this.styles().find((style) => style.id === this.selectedStyle())?.name ?? this.selectedStyle() ?? ''
  );

  // Osobny FormControl zapobiega gubieniu kursora podczas automatycznego zapisu.
  protected readonly safetyControl = new FormControl('', { nonNullable: true });

  constructor() {
    // Reakcja tylko na zmianę identyfikatora aktywnej postaci, nie na każde naciśnięcie klawisza.
    effect(() => {
      const activeId = this.store.activeId();
      const character = untracked(() => this.store.activeCharacter());
      if (character?.id === activeId) {
        this.safetyControl.setValue(character.safetyBoundaries ?? '', { emitEvent: false });
      }
    });

    this.safetyControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((safetyBoundaries) => {
      this.store.updateActive({ safetyBoundaries });
    });
  }

  protected toggleStyle(id: string): void {
    // Nie zapisujemy identyfikatorów spoza katalogu trzech stylów gry.
    if (!this.styles().some((style) => style.id === id)) return;
    const next = this.selectedStyle() === id ? null : id as GameplayStyle;
    this.store.updateActive({ gameplayStyle: next });
  }

  protected selectCharacter(event: Event): void {
    this.store.selectCharacter((event.target as HTMLSelectElement).value);
  }

  protected createCharacter(): void {
    this.store.createCharacter();
  }
}
