import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { CatalogService } from '../../core/services/catalog.service';
import { CharacterStore } from '../../core/storage/character-store.service';

@Component({
  selector: 'app-character-hooks',
  imports: [RouterLink],
  templateUrl: './character-hooks.html',
  styleUrl: './character-hooks.scss',
})
export class CharacterHooks {
  protected readonly store = inject(CharacterStore);
  protected readonly characters = this.store.characters;
  protected readonly activeCharacter = this.store.activeCharacter;
  protected readonly selectedIds = this.store.selectedHookIds;

  protected readonly catalogs = toSignal(inject(CatalogService).catalogs$, {
    initialValue: null,
  });

  protected readonly selectedHooks = computed(() => {
    const data = this.catalogs();
    const chosen = new Set(this.selectedIds());
    return data?.hooks.filter((hook) => chosen.has(hook.id)) ?? [];
  });

  protected isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  protected toggle(id: string): void {
    this.store.toggleHook(id);
  }

  protected removeHook(id: string): void {
    this.store.removeHook(id);
  }

  protected clearSelection(): void {
    this.store.clearHooks();
  }

  protected selectCharacter(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.store.selectCharacter(select.value);
  }

  protected createCharacter(): void {
    this.store.createCharacter();
  }

  protected scrollToHook(id: string): void {
    document.getElementById(`hook-card-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
