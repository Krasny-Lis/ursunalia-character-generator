export type CharacterStatus = 'draft' | 'submitted' | 'in-review' | 'ready';

export type ResidencyStatus = 'resident' | 'visitor';

export type GameplayStyle = 'calm' | 'trouble' | 'high-stakes';

export type RelationOpenness = 'all' | 'consult' | 'self';

export type PillarId = 'politics' | 'mysticism' | 'religion' | 'daily-life' | 'combat' | 'intrigue';

export type PillarRating = 1 | 2 | 3 | 4 | 5;

export interface CharacterRelation {
  id: string;
  personOrCharacter: string;
  description: string;
}

export interface CharacterMaterial {
  id: string;
  title: string;
  content: string;
  published: boolean;
}

export interface CharacterStory {
  goal: string;
  obstacle: string;
  presenceReason: string;
  stakes: string;
  history: string;
}

export interface Character {
  id: string;
  status: CharacterStatus;

  // Tożsamość
  name: string;
  roleId: string;
  occupation: string;

  // Pochodzenie
  regionId: string;
  originDetail: string;
  residency: ResidencyStatus | null;
  cultureId: string;

  // Charakter i historia
  traitIds: string[];
  hookIds: string[];
  story: CharacterStory;

  // Preferencje gracza
  pillarRatings: Partial<Record<PillarId, PillarRating>>;
  gameplayStyle: GameplayStyle | null;

  // Informacje poufne
  safetyBoundaries: string;
  relationshipExclusions: string;

  // Relacje
  relations: CharacterRelation[];
  relationOpenness: RelationOpenness | null;

  // Materiały organizatorów
  materials: CharacterMaterial[];

  // Metadane
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}
