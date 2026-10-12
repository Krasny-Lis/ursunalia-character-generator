import { describe, it, expect } from 'vitest';
import { DEMO_SURVEY } from '../data/demo-survey';
import { moveFieldByIndex } from './survey-builder.logic';

describe('v26.2 live drag-sort: immutable updates', () => {
  it('moves a field within the same section', () => {
    const section = DEMO_SURVEY.sections[0];
    const moved = moveFieldByIndex(DEMO_SURVEY, section.id, 0, section.id, 1);
    expect(moved.sections[0].fields[1].id).toBe(section.fields[0].id);
    expect(DEMO_SURVEY.sections[0].fields[0].id).toBe(section.fields[0].id);
  });
  it('moves across sections, preserving a unique ID', () => {
    const [a, b] = DEMO_SURVEY.sections;
    const id = a.fields[0].id;
    const moved = moveFieldByIndex(DEMO_SURVEY, a.id, 0, b.id, 0);
    expect(moved.sections[1].fields[0].id).toBe(id);
    expect(moved.sections.flatMap(s => s.fields).filter(f => f.id === id)).toHaveLength(1);
  });
  it('rejects invalid indices without mutating draft', () => {
    const section = DEMO_SURVEY.sections[0];
    expect(moveFieldByIndex(DEMO_SURVEY, section.id, 999, section.id, 0)).toBe(DEMO_SURVEY);
  });
});
