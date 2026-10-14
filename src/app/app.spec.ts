import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { App } from './app';
import { PlatformStore } from './platform/platform.store';
import { UiPreviewStore } from './platform/ui-preview.store';
import { routes } from './app.routes';

describe('Ursunalia UI shell', () => {
  it('shows the approved public navigation, without survey search, bell and archives', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes)] });
    const store = TestBed.inject(PlatformStore);
    vi.spyOn(store, 'initialize').mockResolvedValue();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.platform-brand')?.textContent).toContain('URSUNALIA');
    const links = Array.from(root.querySelectorAll('nav[aria-label="Menu główne"] a'))
      .map(link => link.textContent?.trim());
    expect(links).toEqual(['Start', 'O wydarzeniu', 'Świat gry', 'Dla gracza', 'Aktualności']);
    expect(root.querySelector('[aria-label="Szukaj ankiet"]')).toBeNull();
    expect(root.querySelector('a[href="/powiadomienia"]')).toBeNull();
    const toggle = root.querySelector('.menu-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Otwieramy księgę');
    store.ready.set(true);
    await fixture.whenStable();
    expect(root.querySelector('router-outlet')).not.toBeNull();
  });

  it('switches only UI role while leaving actual permissions unchanged', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes)] });
    const store = TestBed.inject(PlatformStore);
    const preview = TestBed.inject(UiPreviewStore);
    vi.spyOn(store, 'initialize').mockResolvedValue();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(store.canAdminEvents()).toBe(false);
    preview.setRole('gm');
    await fixture.whenStable();
    expect(root.querySelector('nav')?.textContent).toContain('Panel MG');
    expect(store.canAdminEvents()).toBe(false);
    preview.setRole('organizer');
    await fixture.whenStable();
    expect(root.querySelector('nav')?.textContent).toContain('Panel organizatora');
    expect(store.canAdminEvents()).toBe(false);
  });
});

describe('UI preview gate', () => {
  it('requires approval, payment and a ready/review document with a link', () => {
    const preview = TestBed.inject(UiPreviewStore);
    preview.setRole('player');
    preview.setCharacter('accepted');
    preview.setPayment('paid');
    preview.setCard('ready');
    expect(preview.canViewCard()).toBe(false);
    preview.hasCardLink.set(true);
    expect(preview.canViewCard()).toBe(true);
    preview.setPayment('unpaid');
    expect(preview.canViewCard()).toBe(false);
    preview.setPayment('paid');
    preview.setCard('preparing');
    expect(preview.canViewCard()).toBe(false);
    preview.setCard('review');
    expect(preview.canViewCard()).toBe(true);
  });
});
