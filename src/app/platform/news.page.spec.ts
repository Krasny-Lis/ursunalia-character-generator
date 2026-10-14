import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { NewsPage } from './news.page';
import { NewsArticlePage } from './news-article.page';
import { UiPreviewStore } from './ui-preview.store';
import { routes } from '../app.routes';

describe('Aktualności – publiczne UI i przykładowe wpisy', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [NewsPage], providers: [provideRouter(routes)] });
    const preview = TestBed.inject(UiPreviewStore);
    preview.setRole('guest');
    return { preview, fixture: TestBed.createComponent(NewsPage) };
  }

  it('shows clearly labeled examples, pinned first, without thumbnails or fabricated dates', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('Podgląd deweloperski');
    expect(root.querySelectorAll('.news-item').length).toBe(2);
    const first = root.querySelector('.news-item');
    expect(first?.textContent).toContain('Przykładowy komunikat');
    expect(first?.classList.contains('news-item--pinned')).toBe(true);
    expect(root.querySelectorAll('.news-item img').length).toBe(0);
    expect(root.querySelectorAll('.news-filters button').length).toBe(3);
    expect(root.querySelector('time')).toBeNull();
  });

  it('supports filters and search with a zero-results state', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    fixture.componentInstance.category.set('fabularne');
    await fixture.whenStable();
    let root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.news-item').length).toBe(1);
    expect(root.textContent).toContain('Przykładowa wieść');
    fixture.componentInstance.search.set('nieodnaleziony temat');
    await fixture.whenStable();
    expect(root.textContent).toContain('Nie znaleziono wpisów');
    fixture.componentInstance.clearFilters();
    await fixture.whenStable();
    root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.news-item').length).toBe(2);
  });

  it('reveals organizer mock only in organizer preview and hides it from other roles', async () => {
    const { preview, fixture } = setup();
    await fixture.whenStable();
    expect(fixture.componentInstance.entries().length).toBe(2);
    preview.setRole('gm');
    await fixture.whenStable();
    expect(fixture.componentInstance.entries().length).toBe(2);
    preview.setRole('organizer');
    await fixture.whenStable();
    expect(fixture.componentInstance.entries().length).toBe(3);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Przykładowy szkic organizatora');
  });

  it('cannot open an organizer-only example as a guest even with a direct URL', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const preview = TestBed.inject(UiPreviewStore);
    preview.setRole('guest');
    const harness = await RouterTestingHarness.create();
    const reader = await harness.navigateByUrl('/aktualnosci/przykladowy-szkic-redakcyjny', NewsArticlePage);
    expect(reader.article()).toBeNull();
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('Wpis niedostępny');
    preview.setRole('organizer');
    await harness.fixture.whenStable();
    expect(reader.article()?.visibility).toBe('organizer');
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('Przykładowy szkic organizatora');
  });
});
