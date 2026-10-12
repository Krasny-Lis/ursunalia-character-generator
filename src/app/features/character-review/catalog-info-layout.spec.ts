import { describe, expect, it } from 'vitest';
import { calculateCatalogInfoPosition } from './catalog-info-layout';

describe('Pozycjonowanie katalogu informacyjnego', () => {
  it('utrzymuje duże okno ponad belką na dole', () => {
    const p = calculateCatalogInfoPosition({top: 470, left: 460, right: 490}, 38, 1200, 650);
    expect(p.top).toBeGreaterThanOrEqual(14);
    expect(p.top + p.maxHeight).toBeLessThanOrEqual(650 - 14);
  });
  it('wyświetla okienko w granicach poziomych viewportu', () => {
    const p = calculateCatalogInfoPosition({top: 55, left: 1050, right: 1100}, 4, 1200, 700);
    expect(p.left).toBeGreaterThanOrEqual(14);
    expect(p.left + 430).toBeLessThanOrEqual(1200 - 14);
  });
});
