import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { ModuleRegistry } from '../modules/module-registry.service';
import type { ModuleId } from '../modules/module-definition';

/** Wyłączenie modułu blokuje trasę; to NIE zastępuje uwierzytelniania backendu. */
export function moduleEnabledGuard(id: ModuleId): CanMatchFn {
  return () => inject(ModuleRegistry).isAvailable(id)
    ? true
    : inject(Router).createUrlTree(['/modul-niedostepny']);
}
