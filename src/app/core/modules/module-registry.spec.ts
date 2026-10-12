import { describe, expect, it } from 'vitest';
import { FEATURE_MODULES } from '../config/features.config';
import { isModuleAvailable } from './module-registry.service';

describe('Dostępność modułów v24', () => {
  it('udostępnia publiczny moduł zdarzenia', () => {
    const event=FEATURE_MODULES.find(module=>module.id==='event')!;
    expect(isModuleAvailable(event,false)).toBe(true);
  });

  it('nie udostępnia modułu organizatora w buildzie produkcyjnym', () => {
    const surveys=FEATURE_MODULES.find(module=>module.id==='surveys')!;
    expect(isModuleAvailable(surveys,false)).toBe(false);
    expect(isModuleAvailable(surveys,true)).toBe(true);
  });

  it('blokuje moduły wyłączone niezależnie od trybu pracy', () => {
    const gallery=FEATURE_MODULES.find(module=>module.id==='gallery')!;
    expect(isModuleAvailable(gallery,false)).toBe(false);
    expect(isModuleAvailable(gallery,true)).toBe(false);
  });
});
