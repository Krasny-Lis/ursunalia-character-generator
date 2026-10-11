import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import type { Character } from '../models/character.model';
import { createDemoCharacters } from '../data/demo-characters';
import { createEmptyCharacter } from '../data/character.factory';

interface StoredCharactersV1 {
  version: 1;
  activeId: string;
  characters: Character[];
}

const STORAGE_KEY = 'ursunalia:character-generator:session:v1';

function isCharacter(value: unknown): value is Character {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v['id'] === 'string'
    && typeof v['name'] === 'string'
    && typeof v['roleId'] === 'string'
    && typeof v['occupation'] === 'string'
    && typeof v['regionId'] === 'string'
    && typeof v['cultureId'] === 'string'
    && Array.isArray(v['traitIds'])
    && v['traitIds'].every((id: unknown) => typeof id === 'string')
    && Array.isArray(v['hookIds'])
    && typeof v['story'] === 'object'
    && v['story'] !== null;
}

@Injectable({ providedIn: 'root' })
export class CharacterStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storage = this.resolveStorage();
  private readonly initial = this.restore() ?? this.createFirstSession();

  private readonly _characters = signal<Character[]>(this.initial.characters);
  private readonly _activeId = signal<string>(this.initial.activeId);
  private readonly _storageAvailable = signal<boolean>(this.storage !== null);

  readonly characters = this._characters.asReadonly();
  readonly activeId = this._activeId.asReadonly();
  readonly storageAvailable = this._storageAvailable.asReadonly();
  readonly activeCharacter = computed(() =>
    this._characters().find((character) => character.id === this._activeId()) ?? null
  );
  readonly selectedTraitIds = computed(() => this.activeCharacter()?.traitIds ?? []);
  readonly selectedHookIds = computed(() => this.activeCharacter()?.hookIds ?? []);

  constructor() {
    // Utrwala również pierwsze uruchomienie z postaciami demonstracyjnymi.
    this.persist();
  }

  createCharacter(): string {
    const character = createEmptyCharacter();
    this._characters.update((all) => [...all, character]);
    this._activeId.set(character.id);
    this.persist();
    return character.id;
  }

  selectCharacter(id: string): void {
    if (!this._characters().some((character) => character.id === id)) return;
    this._activeId.set(id);
    this.persist();
  }

  renameActive(name: string): void {
    this.updateActive({ name });
  }

  /** Możliwość aktualizacji kolejnych pól w przyszłych krokach generatora. */
  updateActive(patch: Partial<Omit<Character, 'id' | 'createdAt'>>): void {
    const activeId = this._activeId();
    this._characters.update((all) => all.map((character) =>
      character.id === activeId
        ? { ...character, ...patch, updatedAt: new Date().toISOString() }
        : character
    ));
    this.persist();
  }

  toggleTrait(id: string): void {
    const ids = this.selectedTraitIds();
    this.setTraits(ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  removeTrait(id: string): void {
    this.setTraits(this.selectedTraitIds().filter((item) => item !== id));
  }

  clearTraits(): void {
    this.setTraits([]);
  }

  private setTraits(ids: string[]): void {
    this.updateActive({ traitIds: [...new Set(ids)] });
  }

  toggleHook(id: string): void {
    const ids = this.selectedHookIds();
    this.setHooks(ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  removeHook(id: string): void {
    this.setHooks(this.selectedHookIds().filter((item) => item !== id));
  }

  clearHooks(): void {
    this.setHooks([]);
  }

  private setHooks(ids: string[]): void {
    this.updateActive({ hookIds: [...new Set(ids)] });
  }

  private resolveStorage(): Storage | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const storage = window.sessionStorage;
      // Może być zablokowany w prywatnych/ograniczonych ustawieniach przeglądarki.
      const probe = '__ursunalia_probe__';
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return storage;
    } catch {
      return null;
    }
  }

  private restore(): StoredCharactersV1 | null {
    if (!this.storage) return null;
    try {
      const text = this.storage.getItem(STORAGE_KEY);
      if (!text) return null;
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') return null;
      const snapshot = parsed as Partial<StoredCharactersV1>;
      if (snapshot.version !== 1 || !Array.isArray(snapshot.characters)
        || !snapshot.characters.length || !snapshot.characters.every(isCharacter)) return null;
      const ids = new Set(snapshot.characters.map((character) => character.id));
      if (ids.size !== snapshot.characters.length) return null;
      const activeId = typeof snapshot.activeId === 'string' && ids.has(snapshot.activeId)
        ? snapshot.activeId
        : snapshot.characters[0].id;
      return { version: 1, activeId, characters: snapshot.characters };
    } catch {
      return null;
    }
  }

  private createFirstSession(): StoredCharactersV1 {
    const characters = createDemoCharacters();
    return { version: 1, activeId: characters[0].id, characters };
  }

  private persist(): void {
    if (!this.storage) return;
    const snapshot: StoredCharactersV1 = {
      version: 1,
      activeId: this._activeId(),
      characters: this._characters(),
    };
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      this._storageAvailable.set(true);
    } catch {
      this._storageAvailable.set(false);
    }
  }
}
