import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AccountPage } from './account.page';
import { PlatformStore } from './platform.store';
import { routes } from '../app.routes';

describe('Moje konto – informacyjny frontend', () => {
  it('shows the available profile data, warns about missing API and has no avatar or archive', async () => {
    TestBed.configureTestingModule({ imports: [AccountPage], providers: [provideRouter(routes)] });
    const store = TestBed.inject(PlatformStore);
    store.mode.set('server');
    store.user.set({ id: 'u-1', name: 'Anna Testowa', email: 'anna@example.invalid', role: 'participant' });
    const fixture = TestBed.createComponent(AccountPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('Anna Testowa');
    expect(text).toContain('anna@example.invalid');
    expect(text).toContain('Telefon');
    expect(text).toContain('Facebook (opcjonalnie)');
    expect(text).toContain('Zmiana hasła — w przygotowaniu');
    expect(root.querySelectorAll('img').length).toBe(0);
    expect(text).not.toContain('Archiwum postaci');
    expect(text).not.toContain('Powiadomienia');
    fixture.componentInstance.editing.set(true);
    await fixture.whenStable();
    expect(root.textContent).toContain('Serwer nie obsługuje jeszcze zapisu pełnego profilu');
    expect(root.querySelector('button[type="submit"]')).toBeNull();
  });

  it('retains the actual login/register form while being transparent about the missing phone field', async () => {
    TestBed.configureTestingModule({ imports: [AccountPage], providers: [provideRouter(routes)] });
    const store = TestBed.inject(PlatformStore);
    store.mode.set('server');
    store.user.set(null);
    const fixture = TestBed.createComponent(AccountPage);
    await fixture.whenStable();
    const page = fixture.componentInstance;
    expect((fixture.nativeElement as HTMLElement).querySelector('input[name="email"]')).not.toBeNull();
    page.mode.set('register');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('input[name="name"]')).not.toBeNull();
    expect(root.textContent).toContain('Docelowy formularz z wymaganym telefonem');
  });
});
