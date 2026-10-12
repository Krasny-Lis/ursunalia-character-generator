import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { DEMO_SURVEY } from '../data/demo-survey';
import { SurveyRenderer } from './survey-renderer';

describe('Renderer ankiet v25', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports:[SurveyRenderer] }).compileComponents();
  });

  it('renderuje sekcje i wymagane pola na podstawie definicji', () => {
    const fixture = TestBed.createComponent(SurveyRenderer);
    fixture.componentRef.setInput('survey', DEMO_SURVEY);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.survey-section').length).toBe(2);
    expect(element.textContent).toContain('Informacje o postaci');
    expect(element.querySelector('input[type=text]')).not.toBeNull();
    expect(element.querySelectorAll('.field-help summary').length).toBeGreaterThan(0);
  });

  it('pokazuje bledy wymaganych pol po sprawdzeniu', () => {
    const fixture = TestBed.createComponent(SurveyRenderer);
    fixture.componentRef.setInput('survey', DEMO_SURVEY);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    (element.querySelector('button[type=submit]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelectorAll('.field-error').length).toBe(2);
  });
});
