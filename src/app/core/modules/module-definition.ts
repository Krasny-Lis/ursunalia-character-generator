export type ModuleId =
  | 'event' | 'character' | 'surveys' | 'player' | 'organizer' | 'admin'
  | 'announcements' | 'knowledge' | 'gallery' | 'mailing' | 'story';

export type ModuleAccess = 'public' | 'development';
export type NavigationGroup = 'public' | 'developer' | 'player' | 'organizer' | 'admin';

export interface ModuleDefinition {
  readonly id: ModuleId;
  readonly label: string;
  readonly path: string;
  readonly enabled: boolean;
  readonly access: ModuleAccess;
  readonly navigationGroup: NavigationGroup;
  /** Future server-validated permission identifiers; no real authorization in v24. */
  readonly permissions: readonly string[];
}
