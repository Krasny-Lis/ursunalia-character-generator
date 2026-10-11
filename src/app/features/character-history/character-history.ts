import { Component, effect, inject, untracked } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CharacterStore } from '../../core/storage/character-store.service';

@Component({
  selector: 'app-character-history',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './character-history.html',
  styleUrl: './character-history.scss',
})
export class CharacterHistory {
  protected readonly store = inject(CharacterStore);
  protected readonly characters = this.store.characters;
  protected readonly activeCharacter = this.store.activeCharacter;

  protected readonly form = new FormGroup({
    goal: new FormControl('', { nonNullable: true, validators: Validators.maxLength(400) }),
    obstacle: new FormControl('', { nonNullable: true, validators: Validators.maxLength(400) }),
    presenceReason: new FormControl('', { nonNullable: true, validators: Validators.maxLength(400) }),
    stakes: new FormControl('', { nonNullable: true, validators: Validators.maxLength(400) }),
    history: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(500)] }),
  });

  protected readonly shortFields = [
    { key: 'goal', label: 'Cel postaci' },
    { key: 'obstacle', label: 'Przeszkoda' },
    { key: 'presenceReason', label: 'Powód obecności' },
    { key: 'stakes', label: 'Co postać ma do stracenia' },
  ];

  constructor() {
    // Zmiana aktywnej postaci przełącza wszystkie odpowiedzi jednocześnie.
    // Nie nasłuchujemy zmian całego obiektu postaci, aby pisanie w textarea
    // nie powodowało resetów pól ani przeskakiwania kursora.
    effect(() => {
      const activeId = this.store.activeId();
      const character = untracked(() => this.store.activeCharacter());
      if (character?.id === activeId) {
        this.form.setValue({ ...character.story }, { emitEvent: false });
      }
    });

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      // Zapis na bieżąco, także przed szybkim przełączeniem postaci.
      this.store.updateActive({ story: this.form.getRawValue() });
    });
  }

  protected get presenceQuestion(): string {
    return this.activeCharacter()?.residency === 'resident'
      ? 'Co sprawia, że Twoja postać bierze udział w tegorocznym Święcie Budzenia Niedźwiedzi?'
      : 'Co sprowadziło Twoją postać na Ziemie Braci właśnie teraz?';
  }

  protected get historyLength(): number {
    return this.form.controls.history.value.length;
  }

  protected get historyComplete(): boolean {
    return this.historyLength >= 500;
  }

  protected get shortAnswered(): number {
    const { goal, obstacle, presenceReason, stakes } = this.form.getRawValue();
    return [goal, obstacle, presenceReason, stakes].filter((v) => !!v.trim()).length;
  }

  protected selectCharacter(event: Event): void {
    this.store.selectCharacter((event.target as HTMLSelectElement).value);
  }

  protected createCharacter(): void {
    this.store.createCharacter();
  }
}
