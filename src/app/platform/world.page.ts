import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';
import { UiPreviewStore } from './ui-preview.store';
import { WORLD_CATEGORIES, WORLD_DEMO_ARTICLES, type WorldCategoryId } from './world-demo.data';

/**
 * Frontend library only. A future CMS must supply published articles; its
 * organizer-only permissions must be checked by the server, not this screen.
 */
@Component({
  standalone: true,
  imports: [RouterLink, Icon],
  templateUrl: './world.page.html',
  styleUrl: './world.page.scss',
})
export class WorldPage {
  readonly preview = inject(UiPreviewStore);
  readonly categories = WORLD_CATEGORIES;
  readonly query = signal('');
  readonly selectedCategory = signal<WorldCategoryId | 'all'>('all');

  readonly availableArticles = computed(() => {
    if (!this.preview.enabled) return [];
    return WORLD_DEMO_ARTICLES.filter(article =>
      article.visibility === 'everyone' || this.preview.role() === 'organizer',
    );
  });
  readonly filteredArticles = computed(() => {
    const q = this.query().trim().toLocaleLowerCase('pl');
    return this.availableArticles().filter(article => {
      if (this.selectedCategory() !== 'all' && article.category !== this.selectedCategory()) return false;
      const name = this.categories.find(category => category.id === article.category)?.title ?? '';
      return !q || [article.title, article.summary, name].some(value =>
        value.toLocaleLowerCase('pl').includes(q),
      );
    });
  });

  categoryName(category: WorldCategoryId) {
    return this.categories.find(item => item.id === category)?.title ?? '';
  }
  selectCategory(category: WorldCategoryId | 'all') {
    this.selectedCategory.set(category);
  }
  clearFilters() {
    this.query.set('');
    this.selectedCategory.set('all');
  }
}
