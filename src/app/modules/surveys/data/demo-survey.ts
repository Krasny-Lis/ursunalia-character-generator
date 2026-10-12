import type { SurveyDefinition } from '../models/survey.model';

/** Dane demonstracyjne, NIE zastepuja istniejacej ankiety postaci. */
export const DEMO_SURVEY: SurveyDefinition = {
  id: 'demo-zgloszenie-v25', schemaVersion: 1, revision: 1, status: 'draft',
  title: 'Przykładowa ankieta zgłoszeniowa',
  description: 'Podgląd silnika ankiet. Dane nie są zapisywane ani wysyłane.',
  sections: [
    {
      id: 'identity', title: 'Informacje o postaci', collapsible: true,
      description: 'Przykładowe pytania ogólne i wybory z edytowalnych katalogów.',
      fields: [
        { id: 'name', type: 'short-text', label: 'Nazwa postaci', required: true, maxLength: 160, placeholder: 'Wpisz nazwę postaci', help: { title: 'Nazwa postaci', paragraphs: ['Podaj imię lub przydomek, którym posługuje się postać.'] } },
        { id: 'culture', type: 'single-choice', appearance: 'cards', label: 'Kultura', required: true,
          help: { title: 'Kultury Kisleva', paragraphs: ['Opisy są inspiracją do tworzenia postaci, a nie obowiązkowym sposobem odgrywania.'] },
          options: [
            { id:'hospodar', label:'Hospodar', description:'Przykładowy opis kultury.' },
            { id:'ungol', label:'Ungoł', description:'Przykładowy opis kultury.' },
            { id:'ropsmen', label:'Ropsmen' },
            { id:'dolgan', label:'Dolganin' },
          ] },
        { id:'occupation', type:'short-text', label:'Opis fachu', required:false, placeholder:'Czym zajmuje się Twoja postać?' },
      ],
    },
    {
      id:'character', title:'Charakter i preferencje', collapsible:true,
      fields: [
        { id:'traits', type:'multi-choice', appearance:'cards', label:'Cechy charakteru', description:'Możesz wybrać kilka cech.', required:false, help: { title:'Cechy charakteru', paragraphs:['To przykład kontrolki wielokrotnego wyboru z opisami.'] }, options:[
          { id:'cautious',label:'Ostrożny',description:'Zwykle woli rozpoznać sytuację przed działaniem.' },
          { id:'loyal',label:'Lojalny',description:'Przywiązuje dużą wagę do danych obietnic.' },
          { id:'ambitious',label:'Ambitny',description:'Dąży do zmiany swojej pozycji.' },
        ] },
        { id:'politics', type:'rating', label:'Preferencje rozgrywki – polityka', required:false, min:1, max:5, minLabel:'Nie interesuje mnie', maxLabel:'Bardzo mnie interesuje' },
        { id:'history', type:'long-text', label:'Historia postaci', required:false, minLength:10, maxLength:600, placeholder:'Opowiedz pokrótce o swojej postaci.' },
        { id:'info-1', type:'info', title:'To wersja testowa', paragraphs:['W kolejnych etapach powstaną zestawy ocen, powtarzalne znajomości oraz edytor drag and drop.'] },
      ],
    },
  ],
};
