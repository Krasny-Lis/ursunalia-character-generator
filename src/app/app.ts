import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PlatformStore } from './platform/platform.store';
import { DevRoleBar } from './platform/dev-role-bar';
import { UiPreviewStore } from './platform/ui-preview.store';
import { Icon } from './platform/icon';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon, DevRoleBar],
  templateUrl: './app.html',
})
export class App {
  readonly store = inject(PlatformStore);
  readonly preview = inject(UiPreviewStore);
  readonly router = inject(Router);
  readonly menu = signal(false);

  readonly publicLinks = [
    { label: 'Start', path: '/' },
    { label: 'O wydarzeniu', path: '/o-wydarzeniu' },
    { label: 'Świat gry', path: '/swiat-gry' },
    { label: 'Dla gracza', path: '/dla-gracza' },
    { label: 'Aktualności', path: '/aktualnosci' },
  ];

  readonly shellRole = computed(() => {
    if (this.preview.enabled) return this.preview.role();
    if (this.store.user()?.role === 'organizer' ||
      this.store.eventGrants().some(g => g.role === 'organizer')) return 'organizer';
    if (this.store.eventGrants().some(g => g.role === 'gm')) return 'gm';
    return this.store.user() ? 'player' : 'guest';
  });

  constructor() {
    void this.store.initialize();
    effect((onCleanup) => {
      const notice = this.store.notice();
      if (!notice) return;
      const handle = setTimeout(() => {
        if (this.store.notice() === notice) this.store.notice.set('');
      }, 5000);
      onCleanup(() => clearTimeout(handle));
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  protect(event: BeforeUnloadEvent) {
    if (this.store.dirty() || this.store.reviewDirty() || this.store.builderDirty() || this.store.adminDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  @HostListener('document:keydown.escape')
  close() {
    this.menu.set(false);
  }
}
