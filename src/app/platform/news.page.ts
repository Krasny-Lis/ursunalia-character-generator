import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';
import { UiPreviewStore } from './ui-preview.store';
import {
  NEWS_DEMO_ENTRIES, newsCategoryLabel, type NewsCategory,
} from './news-demo.data';

@Component({
  standalone: true,
  imports: [RouterLink, Icon],
  templateUrl: './news.page.html',
  styleUrl: './news.page.scss',
})
export class NewsPage {
  readonly preview = inject(UiPreviewStore);
  readonly search = signal('');
  readonly category = signal<NewsCategory | 'all'>('all');
  readonly categoryLabel = newsCategoryLabel;

  /** Mock entries never appear on a production build. */
  readonly entries = computed(() => {
    if (!this.preview.enabled) return [];
    return NEWS_DEMO_ENTRIES.filter(item =>
      item.visibility === 'everyone' || this.preview.role() === 'organizer',
    );
  });

  readonly visible = computed(() => {
    const phrase = this.search().trim().toLocaleLowerCase('pl');
    return this.entries()
      .filter(item => this.category() === 'all' || item.category === this.category())
      .filter(item => !phrase || [item.title, item.excerpt, ...item.paragraphs]
        .some(part => part.toLocaleLowerCase('pl').includes(phrase)))
      .slice().sort((a, b) => Number(b.pinned) - Number(a.pinned));
  });

  clearFilters() {
    this.search.set('');
    this.category.set('all');
  }
}
