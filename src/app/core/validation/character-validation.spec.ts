import { describe, expect, it } from 'vitest';
import { createEmptyCharacter } from '../data/character.factory';
import type { CatalogData } from '../models/catalog-data.model';
import { validateCharacter } from './character-validation';

const catalog: CatalogData = {
  roles: [{ id: 'officials', name: 'Urzędnicy', description: '', examples: [] }],
  regions: [{ id: 'north', name: 'Północny', description: '', tagline: '' }],
  cultures: [{ id: 'ungol', name: 'Ungoł', description: '', tagline: '' }],
  residencies: [{ id: 'resident', name: 'Mieszkaniec', description: '' }],
  gameStyles: [{ id: 'calm', name: 'Spokojna gra', description: '' }],
  pillars: [
    { id: 'politics', name: 'Polityka', description: '', order: 1 },
    { id: 'mysticism', name: 'Mistycyzm', description: '', order: 2 },
    { id: 'religion', name: 'Religia', description: '', order: 3 },
    { id: 'daily-life', name: 'Obyczajowość', description: '', order: 4 },
    { id: 'combat', name: 'Turniej', description: '', order: 5 },
    { id: 'intrigue', name: 'Intrygi', description: '', order: 6 },
  ],
  traitCategories: [], traits: [], hooks: [], relationOpenness: [],
};

function completeCharacter() {
  const character = createEmptyCharacter('test-character');
  character.name = 'Mirosław';
  character.roleId = 'officials';
  character.occupation = 'Pisarz';
  character.regionId = 'north';
  character.residency = 'resident';
  character.cultureId = 'ungol';
  character.story.history = 'A'.repeat(500);
  character.gameplayStyle = 'calm';
  character.pillarRatings = {
    politics: 1, mysticism: 2, religion: 3,
    'daily-life': 4, combat: 5, intrigue: 1,
  };
  return character;
}

describe('validateCharacter', () => {
  it('nie uznaje pustej postaci za kompletne zgłoszenie', () => {
    const result = validateCharacter(createEmptyCharacter('blank'), catalog);
    expect(result.readyCount).toBe(0);
    expect(result.required).toHaveLength(8);
    expect(result.complete).toBe(false);
  });

  it('akceptuje wypełnioną postać bez cech, haków i relacji', () => {
    const result = validateCharacter(completeCharacter(), catalog);
    expect(result.readyCount).toBe(8);
    expect(result.optionalIssues).toHaveLength(0);
    expect(result.complete).toBe(true);
  });

  it('odrzuca obce identyfikatory, 0 punktów i biografię z samych spacji', () => {
    const character = completeCharacter();
    character.cultureId = 'unknown';
    character.pillarRatings.politics = 0 as never;
    character.story.history = ' '.repeat(501);
    const result = validateCharacter(character, catalog);
    expect(result.required.find((entry) => entry.id === 'culture')?.ready).toBe(false);
    expect(result.required.find((entry) => entry.id === 'pillars')?.ready).toBe(false);
    expect(result.required.find((entry) => entry.id === 'history')?.ready).toBe(false);
  });

  it('pokazuje ostrzeżenie, gdy opcjonalna odpowiedź przekracza 400 znaków', () => {
    const character = completeCharacter();
    character.story.goal = 'a'.repeat(401);
    const result = validateCharacter(character, catalog);
    expect(result.readyCount).toBe(8);
    expect(result.optionalIssues).toHaveLength(1);
    expect(result.optionalIssues[0].detail).toContain('o 1');
    expect(result.complete).toBe(false);
  });
});
