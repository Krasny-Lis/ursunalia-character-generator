/**
 * EXAMPLES FOR UI TESTING ONLY.
 *
 * These records never come from a CMS and are not event announcements.
 * They may be shown only in Angular development mode. A production CMS
 * must return already-authorized published entries from the server.
 */
export type NewsCategory = 'organizacyjne' | 'fabularne';
export type NewsVisibility = 'everyone' | 'organizer';

export interface NewsEntry {
  slug: string;
  title: string;
  excerpt: string;
  category: NewsCategory;
  visibility: NewsVisibility;
  pinned: boolean;
  paragraphs: readonly string[];
}

export const NEWS_DEMO_ENTRIES: readonly NewsEntry[] = [
  {
    slug: 'przykladowy-komunikat',
    title: 'Przykładowy komunikat organizatorów',
    excerpt: 'Tak będzie wyglądać ważna, przypięta wiadomość na tablicy aktualności.',
    category: 'organizacyjne',
    visibility: 'everyone',
    pinned: true,
    paragraphs: [
      'To jest wyłącznie przykładowa wiadomość służąca ocenie wyglądu strony. Nie ogłasza rozpoczęcia zapisów, opłat ani żadnych nowych terminów.',
      'Docelowo przypięte wpisy będą wyróżniać szczególnie ważne informacje. Organizatorzy będą mogli zmieniać ich kolejność i publikować aktualizacje bez dodawania zdjęć.',
    ],
  },
  {
    slug: 'przykladowy-wpis-fabularny',
    title: 'Przykładowa wieść z Krywulki',
    excerpt: 'W tym miejscu mogą pojawić się krótkie wieści fabularne ze świata Kisleva.',
    category: 'fabularne',
    visibility: 'everyone',
    pinned: false,
    paragraphs: [
      'To tekst demonstracyjny pokazujący format krótkiej informacji ze świata gry. Nie jest nowym faktem fabularnym ani oficjalnym ogłoszeniem.',
      'Przyszły artykuł może zawierać kilka akapitów oraz opcjonalną ilustrację wewnątrz wpisu. Lista aktualności pozostanie tekstowa, bez obowiązkowych miniaturek.',
    ],
  },
  {
    slug: 'przykladowy-szkic-redakcyjny',
    title: 'Przykładowy szkic organizatora',
    excerpt: 'Demonstracja materiału redakcyjnego, niewidocznego w podglądzie Gościa, Gracza i MG.',
    category: 'organizacyjne',
    visibility: 'organizer',
    pinned: false,
    paragraphs: [
      'Ten wpis istnieje wyłącznie w demonstracyjnych danych frontendu. Symuluje wybór widoczności Organizator w przyszłym edytorze treści.',
      'Prawdziwy dostęp do niepublicznych publikacji będzie musiał być egzekwowany przez backend. Przełącznik ról w makiecie nie jest mechanizmem autoryzacji.',
    ],
  },
];

export function newsCategoryLabel(category: NewsCategory): string {
  return category === 'organizacyjne' ? 'Organizacyjne' : 'Fabularne';
}
