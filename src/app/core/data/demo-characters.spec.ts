import { describe, expect, it } from 'vitest';
import { createDemoCharacters } from './demo-characters';

describe('Royal Manuscript demo character', () => {
  it('ships exactly one demonstrative character with all required form sections', () => {
    const items = createDemoCharacters();
    expect(items).toHaveLength(1);
    const c = items[0];
    expect(c.id).toBe('demo-alena-ostrowidz');
    expect(c.name.trim().length).toBeGreaterThan(0);
    expect(c.roleId).toBeTruthy();
    expect(c.occupation).toBeTruthy();
    expect(c.regionId).toBeTruthy();
    expect(c.cultureId).toBeTruthy();
    expect(c.residency).toBeTruthy();
    expect(c.story.history.length).toBeGreaterThanOrEqual(500);
    expect(c.story.goal).toBeTruthy();
    expect(c.story.obstacle).toBeTruthy();
    expect(c.story.presenceReason).toBeTruthy();
    expect(c.story.stakes).toBeTruthy();
    expect(c.traitIds.length).toBeGreaterThan(0);
    expect(c.hookIds.length).toBeGreaterThan(0);
    expect(Object.keys(c.pillarRatings)).toHaveLength(6);
    expect(Object.values(c.pillarRatings).every(v => Number.isInteger(v) && v! >= 1 && v! <= 5)).toBe(true);
    expect(c.gameplayStyle).toBeTruthy();
    expect(c.relations.length).toBeGreaterThan(0);
    expect(c.relationOpenness).toBeTruthy();
    expect(c.safetyBoundaries).toBeTruthy();
    expect(c.relationshipExclusions).toBeTruthy();
    expect(c.materials.length).toBeGreaterThan(0);
  });
});
