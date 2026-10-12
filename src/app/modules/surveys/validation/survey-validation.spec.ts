import { describe, expect, it } from 'vitest';
import { DEMO_SURVEY } from '../data/demo-survey';
import { validateSurveyAnswers, validateSurveyDefinition, surveyFieldCount } from './survey-validation';

describe('Modul ankiet v25', () => {
  it('akceptuje definicje przykładowej ankiety', () => {
    expect(validateSurveyDefinition(DEMO_SURVEY)).toEqual([]);
    expect(surveyFieldCount(DEMO_SURVEY)).toBe(6);
  });

  it('sprawdza obowiazkowe pola', () => {
    expect(validateSurveyAnswers(DEMO_SURVEY, {}).map(issue => issue.fieldId)).toEqual(['name', 'culture']);
  });

  it('akceptuje poprawne odpowiedzi i puste opcjonalne pola', () => {
    expect(validateSurveyAnswers(DEMO_SURVEY, { name: 'Wojmir', culture: 'ungol' })).toEqual([]);
  });

  it('odrzuca nieistniejaca opcje katalogowa', () => {
    expect(validateSurveyAnswers(DEMO_SURVEY, { name:'Wojmir', culture:'invalid' }).map(issue => issue.fieldId)).toContain('culture');
  });

  it('weryfikuje zakres ocen i dlugosc tekstu', () => {
    const issues = validateSurveyAnswers(DEMO_SURVEY, { name:'Wojmir', culture:'ungol', politics:6, history:'abc' });
    expect(issues.map(issue => issue.fieldId)).toEqual(['politics', 'history']);
  });

  it('nie akceptuje duplikatow odpowiedzi w wyborze wielokrotnym', () => {
    const issues = validateSurveyAnswers(DEMO_SURVEY, { name:'Wojmir', culture:'ungol', traits:['loyal','loyal'] });
    expect(issues.map(issue => issue.fieldId)).toEqual(['traits']);
  });

  it('odrzuca zduplikowane identyfikatory pol i opcji', () => {
    const broken = structuredClone(DEMO_SURVEY);
    broken.sections[1].fields[0].id = 'name';
    expect(validateSurveyDefinition(broken).some(issue => issue.includes('identyfikator'))).toBe(true);
  });
});
