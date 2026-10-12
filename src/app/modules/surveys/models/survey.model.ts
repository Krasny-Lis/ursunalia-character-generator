/** v25: schemat JSON formularza, bez zaleznosci od konkretnego wydarzenia. */
export interface SurveyOption {
  id: string;
  label: string;
  description?: string;
}

export interface SurveyHelp {
  title: string;
  paragraphs: string[];
}

export interface SurveyFieldBase {
  id: string;
  label: string;
  description?: string;
  help?: SurveyHelp;
  required: boolean;
}

export interface SurveyTextField extends SurveyFieldBase {
  type: 'short-text' | 'long-text';
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
}

export interface SurveyChoiceField extends SurveyFieldBase {
  type: 'single-choice' | 'multi-choice';
  appearance?: 'radio' | 'select' | 'cards';
  options: SurveyOption[];
  minSelections?: number;
  maxSelections?: number;
}

export interface SurveyRatingField extends SurveyFieldBase {
  type: 'rating';
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface SurveyInfoField {
  id: string;
  type: 'info';
  title: string;
  paragraphs: string[];
}

export type SurveyField = SurveyTextField | SurveyChoiceField | SurveyRatingField | SurveyInfoField;

export interface SurveySection {
  id: string;
  title: string;
  description?: string;
  collapsible: boolean;
  fields: SurveyField[];
}

export interface SurveyDefinition {
  id: string;
  schemaVersion: 1;
  revision: number;
  status: 'draft' | 'published' | 'archived';
  title: string;
  description?: string;
  sections: SurveySection[];
}

/** Inne typy kontrolki (np. powtarzalna grupa) beda dodawane w kolejnych wersjach. */
export type SurveyAnswer = string | number | string[] | null;
export type SurveyAnswers = Record<string, SurveyAnswer | undefined>;
