import { Component, HostListener, OnDestroy, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, Scroll } from '@angular/router';
import { filter, take } from 'rxjs';

import { EVENT_CONFIG } from './core/config/event.config';
import { ModuleRegistry } from './core/modules/module-registry.service';

/** Wspólna powłoka platformy. Formularz ma własną stronę i zachowuje stan lokalny. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  protected readonly event = EVENT_CONFIG;
  protected readonly navigation = inject(ModuleRegistry).navigation();

  private readonly router = inject(Router);
  private readonly scrollKey = 'ursunalia:platform:reload-scroll:v1';
  private readonly refreshY = this.readReloadScroll();
  private restoreFrame: number | undefined;

  constructor() {
    // Nawigacje SPA i historia (Wstecz/Dalej) obsluguje withInMemoryScrolling.
    // Tylko F5 potrzebuje dodatkowego odtworzenia pozycji po lazy loadingu.
    if (this.refreshY !== null) {
      this.router.events.pipe(filter(event => event instanceof Scroll), take(1)).subscribe(() => {
        this.restoreReloadScroll(this.refreshY!);
      });
    }
  }

  @HostListener('window:pagehide')
  protected saveReloadScroll(): void {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(this.scrollKey, JSON.stringify({
        url: window.location.pathname + window.location.search + window.location.hash,
        y: window.scrollY,
      }));
    } catch { /* Storage moze byc niedostepny. */ }
  }

  private readReloadScroll(): number | null {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return null;
    // Nie odtwarzamy pozycji dla nowo otwartej trasy ani w trakcie zwyklej nawigacji.
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type !== 'reload') return null;
    try {
      const raw = window.sessionStorage.getItem(this.scrollKey);
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object') return null;
      const saved = value as { url?: unknown; y?: unknown };
      const url = window.location.pathname + window.location.search + window.location.hash;
      return saved.url === url && typeof saved.y === 'number' && Number.isFinite(saved.y) && saved.y >= 0
        ? saved.y : null;
    } catch { return null; }
  }

  private restoreReloadScroll(y: number): void {
    if (typeof window === 'undefined' || y === 0) return;
    let frames = 0;
    const attempt = () => {
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      // Formularz laduje sie leniwie i moze jeszcze nie miec pelnej wysokosci.
      if (maxY >= y - 2 || frames++ >= 120) {
        window.scrollTo({ top: Math.min(y, maxY), behavior: 'instant' });
        this.restoreFrame = undefined;
      } else {
        this.restoreFrame = window.requestAnimationFrame(attempt);
      }
    };
    this.restoreFrame = window.requestAnimationFrame(attempt);
  }

  ngOnDestroy(): void {
    if (this.restoreFrame !== undefined && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.restoreFrame);
    }
  }
}
