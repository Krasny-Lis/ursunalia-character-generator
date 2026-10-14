import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Icon } from './icon';
import { UiPreviewStore } from './ui-preview.store';
import { WORLD_CATEGORIES, WORLD_DEMO_ARTICLES } from './world-demo.data';

/** Local reading preview: no unpublished world data is supplied by the API. */
@Component({
  standalone: true,
  imports: [RouterLink, Icon],
  templateUrl: './world-article.page.html',
  styleUrl: './world-article.page.scss',
})
export class WorldArticlePage {
  readonly preview = inject(UiPreviewStore);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  readonly article = computed(() => {
    if (!this.preview.enabled) return null;
    const slug = this.params().get('slug');
    return WORLD_DEMO_ARTICLES.find(item =>
      item.slug === slug && (item.visibility === 'everyone' || this.preview.role() === 'organizer'),
    ) ?? null;
  });

  readonly category = computed(() =>
    WORLD_CATEGORIES.find(item => item.id === this.article()?.category)?.title ?? '',
  );
}
