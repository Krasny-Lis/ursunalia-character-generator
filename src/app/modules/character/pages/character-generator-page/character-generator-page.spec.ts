import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterGeneratorPage } from './character-generator-page';

const VIEW_KEY='ursunalia:character-generator:single-form-view:v1';

describe('Przeniesiony generator postaci v24', () => {
  beforeEach(async () => {
    window.sessionStorage.setItem(VIEW_KEY,'form');
    vi.stubGlobal('matchMedia',vi.fn().mockReturnValue({
      matches:true, media:'(prefers-reduced-motion: reduce)', onchange:null,
      addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),
      removeEventListener:vi.fn(),dispatchEvent:vi.fn(),
    }));
    await TestBed.configureTestingModule({
      imports:[CharacterGeneratorPage],
      providers:[provideHttpClient(),provideHttpClientTesting()],
    }).compileComponents();
  });
  afterEach(() => { vi.unstubAllGlobals(); window.sessionStorage.removeItem(VIEW_KEY); });

  it('wyświetla formularz i Podsumowanie jako dwie zakładki', () => {
    const fixture=TestBed.createComponent(CharacterGeneratorPage);
    fixture.detectChanges();
    const root=fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.single-view-tabs')?.textContent).toContain('Podsumowanie');
    expect(root.querySelector('app-character-review')).not.toBeNull();
  });

  it('przełącza widok bez zmiany strony', () => {
    const fixture=TestBed.createComponent(CharacterGeneratorPage);
    fixture.detectChanges();
    const root=fixture.nativeElement as HTMLElement;
    const before=window.location.href;
    root.querySelectorAll<HTMLButtonElement>('.single-view-tabs button')[1].click();
    fixture.detectChanges();
    expect(window.location.href).toBe(before);
    expect(root.querySelector('.wizard-hero h2')?.textContent).toContain('Podsumowanie');
  });
});
