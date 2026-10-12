import { Component, HostListener, inject, signal } from '@angular/core';
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
  }
  @HostListener('window:beforeunload', ['$event']) protect(event: BeforeUnloadEvent) {
    if (this.store.dirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  @HostListener('document:keydown.escape') close() {
    this.menu.set(false);
    this.search.set(false);
  }
}
