import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { PlayerGuidePage } from './player-guide.page';
import { routes } from '../app.routes';

describe('Dla gracza – poradnik uczestnika', () => {
  it('offers six clear topics and only the approved four-step participation flow', async () => {
    TestBed.configureTestingModule({ imports: [PlayerGuidePage], providers: [provideRouter(routes)] });
    const fixture = TestBed.createComponent(PlayerGuidePage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';

    expect(root.querySelectorAll('.guide-topic-grid a').length).toBe(6);
    expect(root.querySelectorAll('.guide-steps li').length).toBe(4);
    for (const title of ['Jak wziąć udział?', 'Tworzenie postaci',
      'Stroje i wyposażenie', 'Zasady i mechaniki', 'Materiały', 'Najczęstsze pytania']) {
      expect(text).toContain(title);
    }
    expect(text).toContain('jedną aktywną postać');
    expect(text).toContain('przez MG');
    expect(text).toContain('Google Docs');
    expect(text).toContain('Składka');
    expect(text).toContain('nie oznacza');
    expect(root.querySelector('[id="materialy"]')).not.toBeNull();
    expect(root.querySelectorAll('.guide-faq details').length).toBe(4);
    expect(root.querySelector('a[href*="powiadomienia"]')).toBeNull();
    expect(root.querySelector('a[href*="archiw"]')).toBeNull();
    expect(root.querySelectorAll('img').length).toBe(0);
  });

  it('navigates to real existing sections instead of fake forms or payment actions', async () => {
    TestBed.configureTestingModule({ imports: [PlayerGuidePage], providers: [provideRouter(routes)] });
    const fixture = TestBed.createComponent(PlayerGuidePage);
    await fixture.whenStable();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'))
      .map(x => x.getAttribute('href') ?? '');
    expect(links.some(href => href.includes('/konto'))).toBe(true);
    expect(links.some(href => href.includes('/swiat-gry'))).toBe(true);
    expect(links.some(href => href.includes('/aktualnosci'))).toBe(true);
    expect(links.some(href => href.includes('/dla-gracza#udzial'))).toBe(true);
    expect(links.some(href => href.includes('google.com/forms'))).toBe(false);
  });
});
