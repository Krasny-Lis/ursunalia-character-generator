import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';

const VIEW_KEY = 'ursunalia:character-generator:single-form-view:v1';

describe('App – Zgłoszenie postaci i Podsumowanie', () => {
  beforeEach(async () => {
    // Zapewniamy przewidywalny widok początkowy niezależnie od kolejności testów.
    window.sessionStorage.setItem(VIEW_KEY, 'form');

    // jsdom nie implementuje matchMedia; tryb ograniczonego ruchu testuje
    // przełączanie widoku bez oczekiwania na rzeczywiste animacje CSS.
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.removeItem(VIEW_KEY);
  });

  it('pokazuje zgłoszenie postaci na jednej stronie bez router-outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.wizard-hero h2')?.textContent).toContain('Zgłoszenie postaci');
    expect(root.querySelector('router-outlet')).toBeNull();
    expect(root.querySelectorAll('.single-view-tabs button')).toHaveLength(2);
  });

  it('przełącza na Podsumowanie bez zmiany adresu URL', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const before = window.location.href;
    const root = fixture.nativeElement as HTMLElement;
    const tabs = root.querySelectorAll<HTMLButtonElement>('.single-view-tabs button');

    tabs[1].click();
    fixture.detectChanges();

    expect(window.location.href).toBe(before);
    expect(root.querySelector('.wizard-hero h2')?.textContent).toContain('Podsumowanie');
    expect(root.querySelector('.single-view-tabs button.active')?.textContent).toContain('Podsumowanie');
    expect(root.querySelector('app-character-summary')).not.toBeNull();
    expect((root.querySelector('app-character-review') as HTMLElement).style.display).toBe('none');
    expect((root.querySelector('app-character-summary') as HTMLElement).style.display).toBe('block');
  });
});
