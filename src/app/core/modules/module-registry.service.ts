import { isDevMode, Injectable } from '@angular/core';
import { FEATURE_MODULES } from '../config/features.config';
import type { ModuleDefinition, ModuleId } from './module-definition';

/** Pure policy – tested separately from Angular router and runtime mode. */
export function isModuleAvailable(module: ModuleDefinition, development: boolean): boolean {
  return module.enabled && (module.access === 'public' || development);
}

@Injectable({ providedIn: 'root' })
export class ModuleRegistry {
  readonly modules = FEATURE_MODULES;

  get(id: ModuleId): ModuleDefinition | undefined {
    return this.modules.find(module => module.id === id);
  }

  isAvailable(id: ModuleId): boolean {
    const module = this.get(id);
    return !!module && isModuleAvailable(module, isDevMode());
  }

  navigation(): ModuleDefinition[] {
    return this.modules.filter(module => this.isAvailable(module.id)
      && (module.navigationGroup === 'public' || module.navigationGroup === 'developer'));
  }
}
