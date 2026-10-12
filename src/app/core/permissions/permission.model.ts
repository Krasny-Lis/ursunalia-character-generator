/** Model docelowych uprawnień – egzekwowanie nastąpi w backendzie. */
export type UserRole = 'guest' | 'player' | 'organizer' | 'admin';
export type PermissionId =
  | 'profile.read'
  | 'submissions.read'
  | 'submissions.review'
  | 'surveys.edit'
  | 'surveys.publish'
  | 'modules.manage';

export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly PermissionId[]>> = {
  guest: [],
  player: ['profile.read'],
  organizer: ['profile.read', 'submissions.read', 'submissions.review', 'surveys.edit'],
  admin: ['profile.read', 'submissions.read', 'submissions.review', 'surveys.edit', 'surveys.publish', 'modules.manage'],
};

/** Pomocnicza funkcja do lokalnych testów; frontend nie autoryzuje operacji API. */
export function roleHasPermission(role: UserRole, permission: PermissionId): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
