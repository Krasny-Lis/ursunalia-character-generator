import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { PaymentPage } from './payment.page';
import { CharacterDocumentPage } from './character-document.page';
import { PlatformStore } from './platform.store';
import { UiPreviewStore } from './ui-preview.store';
import { routes } from '../app.routes';

describe('Składka i karta postaci – niedostępne API', () => {
  it('shows locked payment before MG approval, no fictional bank details', async () => {
    TestBed.configureTestingModule({ imports: [PaymentPage], providers: [provideRouter(routes)] });
    const store = TestBed.inject(PlatformStore);
    store.mode.set('demo');
    const preview = TestBed.inject(UiPreviewStore);
    preview.setRole('player');
    preview.setCharacter('changes');
    const fixture = TestBed.createComponent(PaymentPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Zablokowana');
    expect(root.querySelector('a[href*="bank"]')).toBeNull();
    preview.setCharacter('accepted');
    await fixture.whenStable();
    expect(root.textContent).toContain('Dane przelewu: numer rachunku');
    expect(root.textContent).not.toContain('Zgłoś wpłatę');
  });

  it('never creates a real Google document link from the preview gate', async () => {
    TestBed.configureTestingModule({ imports: [CharacterDocumentPage], providers: [provideRouter(routes)] });
    const store = TestBed.inject(PlatformStore);
    store.mode.set('demo');
    const preview = TestBed.inject(UiPreviewStore);
    preview.setRole('player');
    preview.setCharacter('accepted');
    preview.setPayment('paid');
    preview.setCard('ready');
    preview.hasCardLink.set(true);
    const fixture = TestBed.createComponent(CharacterDocumentPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Wszystkie warunki są spełnione w podglądzie');
    expect(root.querySelector('a[href*="docs.google.com"]')).toBeNull();
    preview.setPayment('unpaid');
    await fixture.whenStable();
    expect(root.textContent).toContain('Link do dokumentu nie jest teraz dostępny');
  });
});
