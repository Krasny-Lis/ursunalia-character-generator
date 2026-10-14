/**
 * Entirely illustrative public-reading fixtures; NEVER published content.
 * Only rendered by pages behind Angular isDevMode(). Future CMS must replace
 * these samples and enforce permissions on the server before serving text.
 */
export type WorldCategoryId =
  'intro' | 'lands' | 'society' | 'authority' | 'belief';

export interface WorldCategory {
  id: WorldCategoryId;
  title: string;
  description: string;
}
export interface WorldSection {
  id: string;
  title: string;
  paragraphs: string[];
}
export interface WorldArticle {
  slug: string;
  category: WorldCategoryId;
  visibility: 'everyone' | 'organizer';
  title: string;
  summary: string;
  sections: WorldSection[];
}

export const WORLD_CATEGORIES: readonly WorldCategory[] = [
  { id: 'intro', title: 'Wprowadzenie', description: 'Pierwsze kroki w świecie Kisleva.' },
  { id: 'lands', title: 'Ziemie i historia', description: 'Miejsca i wydarzenia kształtujące region.' },
  { id: 'society', title: 'Ludzie i społeczeństwo', description: 'Kultury, obyczaje i codzienne życie.' },
  { id: 'authority', title: 'Władza i organizacje', description: 'Struktury władzy oraz miejscowe ugrupowania.' },
  { id: 'belief', title: 'Wiara i obyczaje', description: 'Święta, kulty i tradycje.' },
];

export const WORLD_DEMO_ARTICLES: readonly WorldArticle[] = [
  {
    slug: 'wprowadzenie-do-kisleva',
    category: 'intro',
    visibility: 'everyone',
    title: 'Wprowadzenie do Kisleva',
    summary: 'Północne królestwo, w którym surowy klimat i wielowiekowe tradycje kształtują życie mieszkańców.',
    sections: [
      {
        id: 'na-polnocy',
        title: 'Na północy Starego Świata',
        paragraphs: [
          'Kislev rozciąga się na rozległych ziemiach północy. Jego mieszkańcy uczą się żyć wśród długich zim, niespokojnych granic i odległych osad.',
          'W codziennym życiu znaczenie mają rodzina, miejscowa wspólnota, wyznawani bogowie i zobowiązania wobec tych, od których zależy bezpieczeństwo.'
        ],
      },
      {
        id: 'hospodarowie-i-ungolowie',
        title: 'Hospodarowie i Ungołowie',
        paragraphs: [
          'W Kislevie spotykają się tradycje Hospodarów i Ungołów. Ich obyczaje i więzi społeczne nie zawsze są jednakowe, lecz na Ziemiach Braci łączą je handel, religia i wspólne zagrożenia.',
          'Postać może być częścią jednej z tych społeczności, a jej pochodzenie często wpływa na to, komu ufa i jakie obowiązki uważa za najważniejsze.'
        ],
      },
      {
        id: 'przyjazd',
        title: 'Przyjazd na Ursunalia',
        paragraphs: [
          'Ursunalia przenoszą historię do okolic Krywulki. Święto Budzenia Niedźwiedzi przyciąga mieszkańców oraz ludzi przybywających z daleka.',
          'Nie musisz znać każdego szczegółu świata, żeby rozpocząć tworzenie postaci. Pozostałe materiały pomagają dobrać jej pochodzenie, zawód i miejsce w lokalnej społeczności.'
        ],
      },
    ],
  },
  {
    slug: 'krywulka-i-ziemie-braci',
    category: 'lands',
    visibility: 'everyone',
    title: 'Krywulka i Ziemie Braci',
    summary: 'Stanica, która łączy okoliczne osady, szlaki handlowe, administrację i życie religijne.',
    sections: [
      {
        id: 'stanica',
        title: 'Stanica Krywulka',
        paragraphs: [
          'Krywulka jest lokalnym ośrodkiem wymiany i przeładunku. Docierają tu dostawy z okolicznych wsi, a towar rusza dalej szlakami lądowymi i wodnymi.',
          'Stanica jest miejscem spotkania różnych grup: chłopów, kupców, zbrojnych, przyjezdnych oraz ludzi związanych z administracją i świątynią.'
        ],
      },
      {
        id: 'forty',
        title: 'Forty i północna granica',
        paragraphs: [
          'Nad bezpieczeństwem Ziem Braci czuwa sieć północnych umocnień. Fort Żaryń stanowi ważny punkt tej okolicy, a wspomnienie walk o Fort Toryńsk nadal ciąży nad obrońcami.',
          'Odległości, trudny teren i groźba napadów sprawiają, że nawet zwykłe decyzje gospodarcze mają tu wymiar polityczny.'
        ],
      },
    ],
  },
  {
    slug: 'spolecznosci-ziem-braci',
    category: 'society',
    visibility: 'everyone',
    title: 'Społeczności Ziem Braci',
    summary: 'Hospodarskie i ungołskie tradycje, wspólne interesy oraz różnice w codziennym życiu.',
    sections: [
      {
        id: 'sasiedzi',
        title: 'Sąsiedzi, nie jedna społeczność',
        paragraphs: [
          'Na Ziemiach Braci żyją społeczności o odmiennej historii i obyczajach. Hospodarowie i Ungołowie spotykają się na targach, przy świętach i w sprawach bezpieczeństwa.',
          'Różnice nie wykluczają współpracy. Dla wielu mieszkańców równie ważne jak pochodzenie jest to, kto potrafi dotrzymać danego słowa.'
        ],
      },
      {
        id: 'codziennosc',
        title: 'Codzienne zajęcia',
        paragraphs: [
          'Okoliczne wsie zapewniają podstawowe zasoby, a Krywulka organizuje ich dalszą wymianę. Na miejscu można spotkać kupców, rzemieślników, chłopów, urzędników i żołnierzy.',
          'Status społeczny bywa widoczny w stroju, zachowaniu, relacjach z władzami i obowiązkach wobec otoczenia.'
        ],
      },
    ],
  },
  {
    slug: 'bogowie-i-sanktuarium',
    category: 'belief',
    visibility: 'everyone',
    title: 'Bogowie i sanktuarium',
    summary: 'Ursun, Darz i Tor oraz religijne oblicze święta Budzenia Niedźwiedzi.',
    sections: [
      {
        id: 'kulty',
        title: 'Wiele kultów, jedno sanktuarium',
        paragraphs: [
          'W Krywulce rozwija się sanktuarium wielu kultów. Osobne miejsca poświęcone są czczonym tutaj bogom, a nad organizacją życia religijnego pieczę sprawuje Kapelan.',
          'Wśród najważniejszych bóstw znajdują się Ursun, Darz i Tor. Wspomina się także o innych kultach, obecnych w tradycji regionu.'
        ],
      },
      {
        id: 'budzenie-niedzwiedzi',
        title: 'Budzenie Niedźwiedzi',
        paragraphs: [
          'Święto stanowi jeden z najważniejszych powodów przyjazdu do Krywulki. Towarzyszy mu pamięć o obrońcach północy i wydarzeniach, które ukształtowały Ziemie Braci.',
          'Jarmark jest częścią życia stanicy, lecz w centrum święta pozostają pamięć, wiara i ludzkie zobowiązania.'
        ],
      },
    ],
  },
  {
    slug: 'zarzad-ziem-braci',
    category: 'authority',
    visibility: 'organizer',
    title: 'Władza na Ziemiach Braci – materiał roboczy',
    summary: 'Przykładowy artykuł dla organizatora pokazujący poziom dostępu i strukturę tekstu.',
    sections: [
      {
        id: 'dwie-dziedziny',
        title: 'Dwie dziedziny odpowiedzialności',
        paragraphs: [
          'Kasztelan odpowiada za sprawy administracyjne i zarządzanie ziemiami, a Kapelan sprawuje pieczę nad życiem religijnym.',
          'Ich obowiązki są odrębne, choć w praktyce często spotykają się w sprawach dotyczących mieszkańców i funkcjonowania stanicy.'
        ],
      },
      {
        id: 'urzednicy',
        title: 'Wykonywanie decyzji',
        paragraphs: [
          'Zadania administracyjne wspiera Kompania Lynska. Jej odpowiedzialność dotyczy spraw urzędowych, a nie roli oddziału wojskowego.',
          'Ten przykładowy materiał nie jest opublikowanym artykułem świata gry. Służy wyłącznie sprawdzeniu widoczności redakcyjnej w lokalnej makiecie.'
        ],
      },
    ],
  },
];
