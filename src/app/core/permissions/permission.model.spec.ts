import { describe, expect, it } from 'vitest';
import { roleHasPermission } from './permission.model';

describe('Model uprawnień – projekt v24', () => {
  it('nie pozwala uczestnikowi publikować ankiet', () => {
    expect(roleHasPermission('player','surveys.publish')).toBe(false);
  });
  it('nie przyznaje organizatorowi pełnych praw administratora', () => {
    expect(roleHasPermission('organizer','modules.manage')).toBe(false);
  });
  it('przewiduje kontrolę administracyjną nad modułami', () => {
    expect(roleHasPermission('admin','modules.manage')).toBe(true);
  });
});
