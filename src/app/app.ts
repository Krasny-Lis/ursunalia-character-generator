import { Component, HostListener, OnDestroy, inject, signal } from '@angular/core';

import { CharacterStore } from './core/storage/character-store.service';
import { CharacterReview } from './features/character-review/character-review';
import { CharacterSummary } from './features/character-summary/character-summary';

type GeneratorView = 'form' | 'card';
const VIEW_KEY = 'ursunalia:character-generator:single-form-view:v1';
const OLD_STEP_KEY = 'ursunalia:character-generator:wizard-step:v1';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CharacterReview, CharacterSummary],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  protected readonly store = inject(CharacterStore);
  protected readonly characters = this.store.characters;
  protected readonly activeCharacter = this.store.activeCharacter;
  protected readonly view = signal<GeneratorView>(this.restoreView());
  protected readonly showTopButton = signal(false);
  protected readonly transitionPhase = signal<'idle' | 'out' | 'in'>('idle');
  protected readonly transitionDirection = signal<'forward' | 'backward'>('forward');
  private viewTransitionTimer?: ReturnType<typeof setTimeout>;
  // Wynik ręcznego zapisu sesji. Nie oznacza wysłania zgłoszenia do organizatora.
  protected readonly saveNotice = signal<'saved' | 'error' | null>(null);
  private saveNoticeTimer?: ReturnType<typeof setTimeout>;

  protected saveDraft(): void {
    if (this.saveNoticeTimer) clearTimeout(this.saveNoticeTimer);
    const saved = this.store.saveDraft();
    this.saveNotice.set(saved ? 'saved' : 'error');
    this.saveNoticeTimer = setTimeout(() => this.saveNotice.set(null), 6000);
  }

  protected dismissSaveNotice(): void {
    if (this.saveNoticeTimer) clearTimeout(this.saveNoticeTimer);
    this.saveNotice.set(null);
  }

  ngOnDestroy(): void {
    if (this.saveNoticeTimer) clearTimeout(this.saveNoticeTimer);
    if (this.viewTransitionTimer) clearTimeout(this.viewTransitionTimer);
  }


  @HostListener('window:scroll')
  protected onScroll(): void {
    this.showTopButton.set(window.scrollY > 420);
  }

  protected scrollToTop(): void {
    if (typeof window === 'undefined') return;
    const reduced = typeof window.matchMedia !== 'function'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top:0, behavior: reduced ? 'instant' : 'smooth' });
  }


  protected show(view: GeneratorView): void {
    if (view === this.view() || this.transitionPhase() !== 'idle') return;

    const reducedMotion = typeof window === 'undefined'
      || typeof window.matchMedia !== 'function'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      this.setCurrentView(view);
      return;
    }

    this.transitionDirection.set(view === 'card' ? 'forward' : 'backward');
    this.transitionPhase.set('out');
    this.viewTransitionTimer = setTimeout(() => {
      // Podmieniamy treść dopiero po zakończeniu wygaszania poprzedniej.
      this.setCurrentView(view);
      this.transitionPhase.set('in');
      this.viewTransitionTimer = setTimeout(() => {
        this.transitionPhase.set('idle');
      }, 45);
    }, 255);
  }

  private setCurrentView(view: GeneratorView): void {
    this.view.set(view);
    if (typeof window !== 'undefined') {
      try { window.sessionStorage.setItem(VIEW_KEY, view); }
      catch { /* Przeglądarka może blokować sessionStorage. */ }
    }
  }

  protected selectCharacter(event: Event): void {
    this.store.selectCharacter((event.target as HTMLSelectElement).value);
  }

  protected createCharacter(): void {
    this.store.createCharacter();
    this.show('form');
  }

  protected skipToContent(): void {
    if (typeof document !== 'undefined') document.getElementById('generator-content')?.focus();
  }

  private restoreView(): GeneratorView {
    if (typeof window === 'undefined') return 'form';
    try {
      const saved = window.sessionStorage.getItem(VIEW_KEY);
      if (saved === 'card' || saved === 'form') return saved;
      // Przy aktualizacji stary krok „Karta postaci” zachowuje swój podgląd.
      return window.sessionStorage.getItem(OLD_STEP_KEY) === '8' ? 'card' : 'form';
    } catch { return 'form'; }
  }
}
