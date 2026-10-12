import { Component, EventEmitter, Input, Output, inject } from '@angular/core';

import type { CatalogData } from '../../core/models/catalog-data.model';
import type { Character, ResidencyStatus } from '../../core/models/character.model';
import { CharacterStore } from '../../core/storage/character-store.service';

/**
 * Edycja podstawowych informacji postaci.
 * Dane i katalogi pochodzą z rodzica; zapis odbywa się w jednym CharacterStore.
 * Sterowanie popupem, zwijanie i walidacja pozostają w CharacterReview.
 */
@Component({
  selector: 'app-character-identity-editor',
  standalone: true,
  imports: [],
  templateUrl: './character-identity-editor.html',
  // Wspólny arkusz zachowuje identyczny wygląd podczas wydzielania komponentów.
  styleUrl: '../character-review/character-review.scss',
  styles: [':host { display: block; min-width: 0; min-height: 0 !important; background: transparent !important; color: inherit; font: inherit; }'],
})
export class CharacterIdentityEditor {
  private readonly store = inject(CharacterStore);

  @Input({ required: true }) c!: Character;
  @Input({ required: true }) data!: CatalogData;
  @Input() highlightedField: string | null = null;
  @Input() activeInfoKey: string | null = null;

  @Output() readonly fieldTouched = new EventEmitter<string>();
  @Output() readonly infoRequested = new EventEmitter<{
    key: 'cultures' | 'roles' | 'regions' | 'residencies'; event: MouseEvent;
  }>();

  protected role() {
    return this.data.roles.find(entry => entry.id === this.c.roleId);
  }
  protected region() {
    return this.data.regions.find(entry => entry.id === this.c.regionId);
  }
  protected culture() {
    return this.data.cultures.find(entry => entry.id === this.c.cultureId);
  }

  protected requestInfo(key: 'cultures' | 'roles' | 'regions' | 'residencies', event: MouseEvent): void {
    this.infoRequested.emit({ key, event });
  }

  protected changeIdentity(field: 'name' | 'occupation' | 'originDetail' | 'roleId' | 'regionId' | 'cultureId', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.store.updateActive({ [field]: value });
  }

  protected changeResidency(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.store.updateActive({ residency: value ? value as ResidencyStatus : null });
  }
}
