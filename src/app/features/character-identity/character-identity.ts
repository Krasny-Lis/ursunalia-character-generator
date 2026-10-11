import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import type { Character, ResidencyStatus } from '../../core/models/character.model';
import { CatalogService } from '../../core/services/catalog.service';
import { CharacterStore } from '../../core/storage/character-store.service';

const STEP_LABELS = ['Nazwa postaci', 'Rola i zajęcie', 'Pochodzenie geograficzne', 'Ziemie Braci', 'Kultura'] as const;

@Component({
  selector: 'app-character-identity',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './character-identity.html',
  styleUrl: './character-identity.scss',
})
export class CharacterIdentity {
  protected readonly store = inject(CharacterStore);
  protected readonly catalogs = toSignal(inject(CatalogService).catalogs$, { initialValue: null });
  protected readonly characters = this.store.characters;
  protected readonly activeCharacter = this.store.activeCharacter;
  protected readonly stepLabels = STEP_LABELS;
  protected readonly step = signal(0);

  // Puste wartości są celowe: nowe postacie nie dziedziczą wyborów z przykładowych.
  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
    roleId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    occupation: new FormControl('', { nonNullable: true, validators: Validators.required }),
    regionId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    originDetail: new FormControl('', { nonNullable: true }),
    residency: new FormControl<ResidencyStatus | null>(null, { validators: Validators.required }),
    cultureId: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });

  protected readonly requiredCompleted = computed(() => {
    const c = this.activeCharacter();
    if (!c) return 0;
    return [c.name.trim(), c.roleId && c.occupation.trim(), c.regionId, c.residency, c.cultureId]
      .filter(Boolean).length;
  });

  constructor() {
    // Angular aktualizuje formularz tylko przy ZMIANIE POSTACI, nie po każdej literze.
    // untracked() zabezpiecza przed resetowaniem kursora podczas wpisywania danych.
    effect(() => {
      this.store.activeId();
      const character = untracked(() => this.store.activeCharacter());
      if (character) this.fillFromCharacter(character);
    });

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const value = this.form.getRawValue();
      this.store.updateActive({
        name: value.name,
        roleId: value.roleId,
        occupation: value.occupation,
        regionId: value.regionId,
        originDetail: value.originDetail,
        residency: value.residency,
        cultureId: value.cultureId,
      });
    });
  }

  private fillFromCharacter(c: Character): void {
    this.form.reset({
      name: c.name,
      roleId: c.roleId,
      occupation: c.occupation,
      regionId: c.regionId,
      originDetail: c.originDetail,
      residency: c.residency,
      cultureId: c.cultureId,
    }, { emitEvent: false });
  }

  protected selectCharacter(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.store.selectCharacter(select.value);
  }

  protected createCharacter(): void {
    this.store.createCharacter();
    this.step.set(0);
    this.scrollTop();
  }

  protected setStep(next: number): void {
    this.step.set(Math.max(0, Math.min(STEP_LABELS.length - 1, next)));
    this.scrollTop();
  }

  protected isStepComplete(index: number): boolean {
    const c = this.activeCharacter();
    if (!c) return false;
    switch (index) {
      case 0: return c.name.trim().length > 0;
      case 1: return !!(c.roleId && c.occupation.trim());
      case 2: return !!c.regionId;
      case 3: return c.residency !== null;
      case 4: return !!c.cultureId;
      default: return false;
    }
  }

  protected fieldError(field: keyof CharacterIdentity['form']['controls']): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  private scrollTop(): void {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
