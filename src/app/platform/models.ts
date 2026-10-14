export type FieldType =
  'text' | 'textarea' | 'single' | 'multi' | 'select' | 'rating' | 'date' | 'file' | 'info';
export interface Option {
  id: string;
  label: string;
  description?: string;
}
export interface Field {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  description?: string;
  placeholder?: string;
  options?: Option[];
  minLength?: number;
  maxLength?: number;
  minSelections?: number;
  maxSelections?: number;
  min?: number;
  max?: number;
}
export interface Section {
  id: string;
  title: string;
  description?: string;
  fields: Field[];
}
export interface FormDefinition {
  id: string;
  eventId: string;
  revision: number;
  status: 'draft' | 'published';
  title: string;
  description?: string;
  sections: Section[];
}
export type Answer = string | number | string[];
export type Answers = Record<string, Answer>;
export type CharacterStatus = 'draft' | 'submitted' | 'accepted' | 'changes' | 'rejected';
export const statusLabel = (status: string) => ({ draft: 'W edycji', submitted: 'Do weryfikacji',
  changes: 'Do poprawy', accepted: 'Zaakceptowana', rejected: 'Odrzucona' } as Record<string,string>)[status] ?? status;
export interface CharacterForm { eventId: string; formId: string; formRevision: number; }
export interface CharacterDecision {
  id: string; actorId: string; actorName: string; decidedAt: string;
  action: 'decision' | 'unlock'; fromStatus: CharacterStatus; status: CharacterStatus;
  comment: string; characterRevision: number;
}
export interface Application {
  id: string;
  form: FormDefinition;
  answers: Answers;
  status: CharacterStatus;
  kind?: 'character' | 'survey';
  eventId?: string;
  revision?: number;
  history?: CharacterDecision[];
  migrated?: boolean;
  updatedAt: string;
  submittedAt?: string;
  feedback?: string;
  userName?: string;
  userEmail?: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'participant' | 'organizer';
}
export interface GameEvent {
  id: string;
  name: string;
  subtitle: string;
  date: string;
  location: string;
  locationNote: string;
  description: string;
  status: string;
  published?: boolean;
  registrationsOpen?: boolean;
  revision?: number;
}
export interface EventGrant { eventId: string; role: 'organizer' | 'gm'; }
export interface EventMembership { eventId: string; status: 'joined'; joinedAt: string; }
export interface Seed {
  event: GameEvent;
  forms: FormDefinition[];
  example: Answers;
}
