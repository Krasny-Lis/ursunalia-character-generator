import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { WorldPage } from './world.page';
import { WorldArticlePage } from './world-article.page';
import { UiPreviewStore } from './ui-preview.store';
import { routes } from '../app.routes';

describe('Biblioteka świata gry – podgląd frontendowy', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [WorldPage],
      providers: [provideRouter(routes)],
    });
    const preview = TestBed.inject(UiPreviewStore);
    preview.setRole('guest');
    return { preview, fixture: TestBed.createComponent(WorldPage) };
  }

  it('has five filters and searchable sample articles without image thumbnails', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.world-categories button').length).toBe(6);
    expect(root.querySelectorAll('.world-article').length).toBe(4);
    expect(root.querySelectorAll('.world-article img').length).toBe(0);
    fixture.componentInstance.selectCategory('belief');
    await fixture.whenStable();
    expect(root.querySelectorAll('.world-article').length).toBe(1);
    expect(root.textContent).toContain('Bogowie i sanktuarium');
    fixture.componentInstance.selectCategory('all');
    fixture.componentInstance.query.set('Krywulka');
    await fixture.whenStable();
    expect(root.querySelectorAll('.world-article').length).toBe(1);
  });

  it('shows organizer sample only to organizer role within dev preview', async () => {
    const { preview, fixture } = setup();
    await fixture.whenStable();
    expect(fixture.componentInstance.availableArticles().some(x => x.visibility === 'organizer')).toBe(false);
    preview.setRole('organizer');
    await fixture.whenStable();
    expect(fixture.componentInstance.availableArticles().some(x => x.visibility === 'organizer')).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('materiał roboczy');
  });

  it('keeps the organizer-only sample unavailable to the guest article reader', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const preview = TestBed.inject(UiPreviewStore);
    preview.setRole('guest');
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/swiat-gry/zarzad-ziem-braci', WorldArticlePage);
    expect(page.article()).toBeNull();
    preview.setRole('organizer');
    await harness.fixture.whenStable();
    expect(page.article()?.visibility).toBe('organizer');
    expect((harness.routeNativeElement as HTMLElement).querySelectorAll('.world-reader-toc a').length).toBe(2);
  });
});
