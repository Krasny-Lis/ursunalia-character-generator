import type { Character } from '../models/character.model';
import { createEmptyCharacter } from './character.factory';

/** Jedna kompletna postać testowa. Wszystkie dane są fikcyjne. */
export function createDemoCharacters(): Character[] {
  const character: Character = {
    ...createEmptyCharacter('demo-alena-ostrowidz'),
    name: 'Alena z Białej Doliny',
    status: 'draft',
    roleId: 'military-nobility',
    occupation: 'Zwiadowczyni fortowa i posłanka kasztelana',
    regionId: 'north',
    originDetail: 'Biała Dolina, północne pogranicze niedaleko Fortu Żaryń',
    residency: 'resident',
    cultureId: 'hospodar',
    traitIds: ['honorowy', 'porywczy', 'przekorny'],
    hookIds: ['dlug', 'nierozwiazany-spor'],
    story: {
      goal: 'Zdobyć zaufanie dowództwa i odkryć, kto przechwytuje wiadomości z północnych posterunków.',
      obstacle: 'Dawny dług wobec kupieckiej rodziny z Krywulki podważa jej niezależność.',
      presenceReason: 'Jako zwiadowczyni i posłanka ma zabezpieczać drogi w czasie Budzenia Niedźwiedzi.',
      stakes: 'Dobre imię rodziny, służbę w forcie i bezpieczeństwo bliskich.',
      history: 'Alena wychowała się w Białej Dolinie, gdzie zimą zamierały szlaki, a każdy sąsiad miał swoją historię. Jej rodzina przez pokolenia strzegła przepraw i dostarczała zwiadowców do północnych fortów. Gdy była młodsza, podczas zamieci zaginął oddział, w którym służył jej starszy brat. Nigdy nie odnaleziono wszystkich śladów ani zapisów z wyprawy. Alena zaczęła pracę jako przewodniczka karawan, później dołączyła do służby w Forcie Żaryń. Nauczyła się rozpoznawać znaki na drogach, słuchać opowieści i nie ufać łatwym odpowiedziom. Zawdzięcza życie kupcowi z Krywulki, którego pomoc okazała się kosztownym zobowiązaniem. Teraz wiosenny jarmark sprowadza wielu przyjezdnych, a z północy nadchodzą niepokojące wieści. Alena wierzy, że wśród gości może znaleźć osobę, która zna prawdę o tamtej wyprawie. Wie też, że nie każdy sekret powinien ujrzeć światło dzienne.'
    },
    pillarRatings: {
      politics: 4,
      mysticism: 3,
      religion: 4,
      'daily-life': 3,
      combat: 4,
      intrigue: 5
    },
    gameplayStyle: 'high-stakes',
    relationOpenness: 'consult',
    relations: [
      { id: 'alena-relation-1', personOrCharacter: 'Dymitr z Krywulki', description: 'Kupiec, który niegdyś uratował jej życie; wciąż oczekuje spłaty przysługi.' },
      { id: 'alena-relation-2', personOrCharacter: 'Strażnicy Fortu Żaryń', description: 'Towarzysze służby. Część ufa jej osądowi, inni podejrzewają ukryte lojalności.' }
    ],
    safetyBoundaries: 'Przed intensywnymi scenami przesłuchań lub przemocy proszę uzgodnić ich zakres poza postacią.',
    relationshipExclusions: 'Brak wskazanych osób; nowe bliskie relacje proszę wcześniej uzgodnić.',
    materials: [
      { id: 'alena-material-1', title: 'Notatka z patrolu', content: 'Trzy ślady na starym trakcie, z których jeden prowadzi w stronę Krywulki.', published: true }
    ]
  };
  return [character];
}
