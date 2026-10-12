import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CharacterStore } from '../../core/storage/character-store.service';
import type { Character } from '../../core/models/character.model';
import type { CatalogData } from '../../core/models/catalog-data.model';
import { CharacterCatalogEditor } from '../character-catalog-editor/character-catalog-editor';
import { CharacterStoryEditor } from '../character-story-editor/character-story-editor';
import { CharacterRelationsEditor } from '../character-relations-editor/character-relations-editor';
import { CharacterPreferencesEditor } from '../character-preferences-editor/character-preferences-editor';

function fixtures() {
  const character = {
    id: 'test',
    traitIds: ['honest'], hookIds: ['debt'],
    story: { goal: '', obstacle: '', presenceReason: '', stakes: '', history: '' },
    relations: [{ id: 'rel1', personOrCharacter: 'Stara znajoma', description: 'Dawna przyjaźń' }],
    pillarRatings: {}, gameplayStyle: null, relationOpenness: null,
    safetyBoundaries: '', relationshipExclusions: '',
  } as unknown as Character;
  const data = {
    traits: [{ id: 'honest', name: 'Honorowy', description: 'Dotrzymuje słowa.' }],
    hooks: [{ id: 'debt', name: 'Dług', description: 'Ktoś czeka na spłatę.' }],
    pillars: [{ id: 'politics', name: 'Polityka', order: 1, description: 'Rozgrywka polityczna.' }],
    gameStyles: [{ id: 'calm', name: 'Spokojny', description: 'Spokojna gra' }],
    relationOpenness: [{ id: 'all', name: 'Otwarte', description: 'Otwartość' }],
  } as unknown as CatalogData;
  const store = {
    activeId: signal('test'),
    toggleTrait: vi.fn(), removeTrait: vi.fn(),
    toggleHook: vi.fn(), removeHook: vi.fn(),
    updateActive: vi.fn(),
  };
  return { character, data, store };
}

async function setup<T>(component: any, inputs: Record<string, unknown>, store: object) {
  await TestBed.configureTestingModule({
    imports: [component], providers: [{ provide: CharacterStore, useValue: store }],
  }).compileComponents();
  const fixture = TestBed.createComponent<T>(component);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return fixture;
}

describe('Edytory po refaktorze v18–v23', () => {
  it('cechy: wybranie i usunięcie aktualizują CharacterStore', async () => {
    const { character, data, store } = fixtures();
    const fixture = await setup<CharacterCatalogEditor>(CharacterCatalogEditor,
      { kind: 'traits', c: character, data, selected: data.traits }, store);
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(store.toggleTrait).toHaveBeenCalledWith('honest');
    root.querySelector<HTMLButtonElement>('.chosen-catalog-remove')!.click();
    expect(store.removeTrait).toHaveBeenCalledWith('honest');
  });

  it('haki: wybór działa niezależnie od cech', async () => {
    const { character, data, store } = fixtures();
    const fixture = await setup<CharacterCatalogEditor>(CharacterCatalogEditor,
      { kind: 'hooks', c: character, data, selected: data.hooks }, store);
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLInputElement>('input[type="checkbox"]')!
      .dispatchEvent(new Event('change', { bubbles: true }));
    expect(store.toggleHook).toHaveBeenCalledWith('debt');
    root.querySelector<HTMLButtonElement>('.chosen-catalog-remove')!.click();
    expect(store.removeHook).toHaveBeenCalledWith('debt');
  });

  it('historia: edycja nie nadpisuje pozostałych pól opowieści', async () => {
    const { character, data, store } = fixtures();
    const fixture = await setup<CharacterStoryEditor>(CharacterStoryEditor, { c: character, data }, store);
    const field = (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>(
      '[data-validation-field="goal"] textarea')!;
    field.value = 'Odzyskać rodową ziemię';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(store.updateActive).toHaveBeenCalledWith({
      story: { ...character.story, goal: 'Odzyskać rodową ziemię' },
    });
  });

  it('znajomości: aktualizacja relacji zachowuje jej identyfikator', async () => {
    const { character, data, store } = fixtures();
    const fixture = await setup<CharacterRelationsEditor>(CharacterRelationsEditor, { c: character, data }, store);
    const field = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '.relation-edit-row input[type="text"]')!;
    field.value = 'Nowa znajoma';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(store.updateActive).toHaveBeenCalledWith({
      relations: [{ id: 'rel1', personOrCharacter: 'Nowa znajoma', description: 'Dawna przyjaźń' }],
    });
  });

  it('preferencje: kliknięcie filaru zapisuje ocenę', async () => {
    const { character, data, store } = fixtures();
    const fixture = await setup<CharacterPreferencesEditor>(CharacterPreferencesEditor, { c: character, data }, store);
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.rating-actions button')!;
    button.click();
    expect(store.updateActive).toHaveBeenCalledWith({ pillarRatings: { politics: 1 } });
  });
});
