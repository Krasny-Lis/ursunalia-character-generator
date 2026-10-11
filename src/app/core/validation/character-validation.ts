import type { CatalogData } from '../models/catalog-data.model';
import type { Character, PillarId } from '../models/character.model';

/** Kontrola kompletności do podsumowania; nie zmienia danych postaci i nie wysyła zgłoszenia. */
export interface ValidationItem {
  id: string;
  label: string;
  ready: boolean;
  detail: string;
  route: string;
}

export interface CharacterValidation {
  required: ValidationItem[];
  optionalIssues: ValidationItem[];
  readyCount: number;
  complete: boolean;
}

const SHORT_FIELDS = [
  { key: 'goal', label: 'Cel postaci' },
  { key: 'obstacle', label: 'Przeszkoda' },
  { key: 'presenceReason', label: 'Powód obecności' },
  { key: 'stakes', label: 'Co ma do stracenia' },
] as const;

const containsId = (items: readonly { id: string }[], id: string | null): boolean =>
  id !== null && items.some((entry) => entry.id === id);

/**
 * Walidacja według uzgodnionych wymagań formularza Ursunalia 2027.
 * Puste pola opcjonalne są poprawne; krótkie odpowiedzi nie mogą przekroczyć 400 znaków.
 */
export function validateCharacter(character: Character, catalogs: CatalogData): CharacterValidation {
  const story = character.story;
  const historyLength = story.history.trim().length;
  const ungradedPillars = catalogs.pillars.filter((pillar) => {
    const rating = character.pillarRatings[pillar.id as PillarId];
    return !Number.isInteger(rating) || rating === undefined || rating < 1 || rating > 5;
  });

  const required: ValidationItem[] = [
    {
      id: 'name', label: 'Nazwa postaci',
      ready: character.name.trim().length > 0 && character.name.length <= 160,
      detail: !character.name.trim() ? 'Wpisz nazwę postaci.' : 'Nazwa nie może przekraczać 160 znaków.',
      route: '/',
    },
    {
      id: 'role', label: 'Rola społeczna i zawód',
      ready: containsId(catalogs.roles, character.roleId) && character.occupation.trim().length > 0,
      detail: !containsId(catalogs.roles, character.roleId)
        ? 'Wybierz rolę społeczną z katalogu.' : 'Dopisz konkretne zajęcie postaci.',
      route: '/',
    },
    {
      id: 'region', label: 'Region pochodzenia',
      ready: containsId(catalogs.regions, character.regionId),
      detail: 'Wybierz region pochodzenia z katalogu.', route: '/',
    },
    {
      id: 'residency', label: 'Status na Ziemiach Braci',
      ready: containsId(catalogs.residencies, character.residency),
      detail: 'Wybierz: Mieszkaniec lub Przybyły.', route: '/',
    },
    {
      id: 'culture', label: 'Pochodzenie kulturowe',
      ready: containsId(catalogs.cultures, character.cultureId),
      detail: 'Wybierz pochodzenie kulturowe z katalogu.', route: '/',
    },
    {
      id: 'history', label: 'Biografia (min. 500 znaków)',
      ready: historyLength >= 500,
      detail: `Dopisz jeszcze ${Math.max(0, 500 - historyLength)} znaków biografii.`,
      route: '/history',
    },
    {
      id: 'pillars', label: 'Oceny wszystkich sześciu filarów',
      ready: catalogs.pillars.length === 6 && ungradedPillars.length === 0,
      detail: catalogs.pillars.length !== 6
        ? 'Katalog filarów jest niekompletny – oczekiwano sześciu.'
        : `Brakuje prawidłowej oceny (1–5): ${ungradedPillars.map((entry) => entry.name).join(', ')}.`,
      route: '/pillars',
    },
    {
      id: 'gameplay', label: 'Dominujący styl gry',
      ready: containsId(catalogs.gameStyles, character.gameplayStyle),
      detail: 'Wybierz jeden dominujący styl gry.', route: '/gameplay',
    },
  ];

  const optionalIssues = SHORT_FIELDS.flatMap(({ key, label }): ValidationItem[] => {
    const length = story[key].length;
    if (length <= 400) return [];
    return [{
      id: key, label,
      ready: false,
      detail: `Przekroczono limit 400 znaków o ${length - 400}. Skróć odpowiedź.`,
      route: '/history',
    }];
  });

  const readyCount = required.filter((item) => item.ready).length;
  return {
    required, optionalIssues, readyCount,
    complete: readyCount === required.length && optionalIssues.length === 0,
  };
}
