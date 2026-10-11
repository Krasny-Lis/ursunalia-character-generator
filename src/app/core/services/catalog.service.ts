import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, shareReplay } from 'rxjs';
import type {
  CatalogEntry,
  HookEntry,
  PillarEntry,
  RoleEntry,
  StereotypeEntry,
  TraitEntry,
} from '../models/catalog.model';
import type { CatalogData, TraitCategoryEntry } from '../models/catalog-data.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  /**
   * Jednorazowo ładuje dane statyczne; kolejne subskrypcje korzystają z cache.
   * Adresy są relatywne do <base href>, więc zadziałają na GitHub Pages
   * i po przeniesieniu aplikacji do innej lokalizacji na Oracle.
   */
  readonly catalogs$ = forkJoin({
    roles: this.http.get<RoleEntry[]>('data/roles.json'),
    regions: this.http.get<StereotypeEntry[]>('data/regions.json'),
    cultures: this.http.get<StereotypeEntry[]>('data/cultures.json'),
    traitCategories: this.http.get<TraitCategoryEntry[]>('data/trait-categories.json'),
    traits: this.http.get<TraitEntry[]>('data/traits.json'),
    hooks: this.http.get<HookEntry[]>('data/hooks.json'),
    pillars: this.http.get<PillarEntry[]>('data/pillars.json'),
    gameStyles: this.http.get<CatalogEntry[]>('data/game-styles.json'),
    residencies: this.http.get<CatalogEntry[]>('data/residencies.json'),
    relationOpenness: this.http.get<CatalogEntry[]>('data/relation-openness.json'),
  }).pipe(shareReplay({ bufferSize: 1, refCount: false }));
}
