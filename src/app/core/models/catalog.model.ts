export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
}

export interface RoleEntry extends CatalogEntry {
  examples: string[];
}

export interface TraitEntry extends CatalogEntry {
  categoryId: string;
  subtitle?: string;
}

export interface HookEntry extends CatalogEntry {
  subtitle?: string;
}

export interface StereotypeEntry extends CatalogEntry {
  tagline: string;
}

export interface PillarEntry extends CatalogEntry {
  order: number;
}
