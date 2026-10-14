import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Icon } from './icon';
import { UiPreviewStore } from './ui-preview.store';
import { NEWS_DEMO_ENTRIES, newsCategoryLabel } from './news-demo.data';

@Component({
  standalone: true,
  imports: [RouterLink, Icon],
  templateUrl: './news-article.page.html',
  styleUrl: './news-article.page.scss',
})
export class NewsArticlePage {
  readonly preview = inject(UiPreviewStore);
  readonly categoryLabel = newsCategoryLabel;
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  readonly article = computed(() => {
    if (!this.preview.enabled) return null;
    const slug = this.params().get('slug');
    return NEWS_DEMO_ENTRIES.find(item =>
      item.slug === slug &&
      (item.visibility === 'everyone' || this.preview.role() === 'organizer'),
    ) ?? null;
  });
}
