import type { Character } from '../models/character.model';

/** Tworzy postać bez domyślnych zaznaczeń i bez ukrytych odpowiedzi. */
export function createEmptyCharacter(id: string = crypto.randomUUID()): Character {
  const now = new Date().toISOString();

  return {
    id,
    status: 'draft',
    name: '',
    roleId: '',
    occupation: '',
    regionId: '',
    originDetail: '',
    residency: null,
    cultureId: '',
    traitIds: [],
    hookIds: [],
    story: {
      goal: '',
      obstacle: '',
      presenceReason: '',
      stakes: '',
      history: '',
    },
    pillarRatings: {},
    gameplayStyle: null,
    safetyBoundaries: '',
    relationshipExclusions: '',
    relations: [],
    relationOpenness: null,
    materials: [],
    createdAt: now,
    updatedAt: now,
  };
}
