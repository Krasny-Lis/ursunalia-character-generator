import type { Character } from '../models/character.model';
import { createEmptyCharacter } from './character.factory';

/** Dane fikcyjne, bez informacji o rzeczywistych uczestnikach. */
export function createDemoCharacters(): Character[] {
  const fixture = (
    id: string,
    name: string,
    occupation: string,
    roleId: string,
    regionId: string,
    cultureId: string,
    residency: 'resident' | 'visitor',
    traitIds: string[],
    hookIds: string[],
  ): Character => ({
    ...createEmptyCharacter(id),
    name,
    occupation,
    roleId,
    regionId,
    cultureId,
    residency,
    traitIds,
    hookIds,
  });

  return [
    fixture('demo-miroslaw', 'Mirosław Żelazna Pięść', 'Strażnik Fortu Żaryń',
      'military-nobility', 'east', 'ungol', 'resident',
      ['honorowy', 'porywczy', 'przekorny'], ['dlug', 'nierozwiazany-spor']),
    fixture('demo-jadwiga', 'Jadwiga z Truskawca', 'Kupczyni bławatna',
      'crafts-merchants-artists', 'west', 'hospodar', 'visitor',
      ['ambitny', 'wyrachowany'], ['spor-o-dziedzictwo', 'pech-w-milosci']),
    fixture('demo-zywanna', 'Żywanna Wichrowa', 'Aptekarka',
      'medics-scholars', 'south', 'ropsmen', 'resident',
      ['skryty', 'zabobonny'], ['mroczna-tajemnica', 'naznaczony']),
    fixture('demo-borys', 'Borys Północny Wiatr', 'Koczownik',
      'wanderers-nomads', 'north', 'dolgan', 'visitor',
      ['prozny', 'ryzykant'], ['ocalony', 'spalone-mosty']),
  ];
}
