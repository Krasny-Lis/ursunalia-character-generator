import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { App } from './app';
import { PlatformStore } from './platform/platform.store';
import { routes } from './app.routes';
describe('Royal Manuscript application shell', () => {
  it('keeps the brand, mobile navigation and loading state accessible before bootstrap', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes)] });
    const store = TestBed.inject(PlatformStore);
    vi.spyOn(store, 'initialize').mockResolvedValue();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.platform-brand')?.textContent).toContain('URSUNALIA');
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
});
