import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PlatformStore } from './platform/platform.store';
import { Icon } from './platform/icon';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon],
  templateUrl: './app.html',
})
export class App {
  readonly store = inject(PlatformStore);
  readonly router = inject(Router);
  readonly menu = signal(false);
  readonly search = signal(false);
  readonly query = signal('');
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
  @HostListener('window:beforeunload', ['$event']) protect(event: BeforeUnloadEvent) {
    if (this.store.dirty() || this.store.reviewDirty() || this.store.builderDirty() || this.store.adminDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  @HostListener('document:keydown.escape') close() {
    this.menu.set(false);
    this.search.set(false);
  }
}
