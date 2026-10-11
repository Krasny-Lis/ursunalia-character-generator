import type {
  CatalogEntry,
  HookEntry,
  PillarEntry,
  RoleEntry,
  StereotypeEntry,
  TraitEntry,
} from './catalog.model';

export interface TraitCategoryEntry {
  id: string;
  name: string;
  order: number;
}

/** Definicje opcji; nie przechowujemy tu prywatnych danych postaci. */
export interface CatalogData {
  roles: RoleEntry[];
  regions: StereotypeEntry[];
  cultures: StereotypeEntry[];
  traitCategories: TraitCategoryEntry[];
  traits: TraitEntry[];
  hooks: HookEntry[];
  pillars: PillarEntry[];
  gameStyles: CatalogEntry[];
  residencies: CatalogEntry[];
  relationOpenness: CatalogEntry[];
}
