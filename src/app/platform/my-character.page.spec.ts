import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { MyCharacterPage } from './my-character.page';
import { PlatformStore } from './platform.store';
import { UiPreviewStore } from './ui-preview.store';
import { routes } from '../app.routes';
import type { Application, FormDefinition, GameEvent, Seed } from './models';

const event: GameEvent = {
  id: 'ursunalia-2027', name: 'Ursunalia 2027', subtitle: '', date: '22–24 kwietnia 2027',
  location: '', locationNote: '', description: '', status: 'W przygotowaniu',
};
const form: FormDefinition = {
  id: 'character-2027', eventId: event.id, revision: 1, status: 'published',
  title: 'Postać', description: '', sections: [{
    id: 'identity', title: 'Tożsamość', fields: [
      { id: 'name', label: 'Imię postaci', type: 'text', required: true },
      { id: 'origin', label: 'Pochodzenie', type: 'select', required: false, options: [
        { id: 'ungol', label: 'Ungoł' }, { id: 'hospodar', label: 'Hospodar' },
      ] },
    ],
  }],
};
const character: Application = {
  id: 'char-1', form, answers: { name: 'Bogdan', origin: 'ungol' },
  kind: 'character', eventId: event.id, revision: 1,
  status: 'changes', locked: false, updatedAt: '2026-10-14T13:00:00Z',
  feedback: 'Doprecyzuj historię.',
  history: [{
    id: 'decision-1', actorId: 'gm-1', actorName: 'MG',
    decidedAt: '2026-10-14T13:00:00Z', action: 'decision',
    fromStatus: 'submitted', status: 'changes',
    comment: 'Doprecyzuj historię.', characterRevision: 1,
  }],
};
function setup() {
  TestBed.configureTestingModule({ imports: [MyCharacterPage], providers: [provideRouter(routes)] });
  const store = TestBed.inject(PlatformStore);
  const preview = TestBed.inject(UiPreviewStore);
  store.mode.set('demo');
  store.seed.set({ event, forms: [form], example: {} } satisfies Seed);
  store.forms.set([form]);
  store.applications.set([character]);
  store.activeId.set(character.id);
  store.dirty.set(false);
  preview.setRole('player');
  preview.setCharacter('changes');
  preview.locked.set(false);
  return { store, preview, fixture: TestBed.createComponent(MyCharacterPage) };
}

describe('Moja postać – widok i edycja', () => {
  it('shows true answer values, feedback, decision history and no profile image', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('Bogdan');
    expect(text).toContain('Ungoł');
    expect(text).toContain('Doprecyzuj historię.');
    expect(text).toContain('HISTORIA DECYZJI MG');
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelectorAll('.my-character-tabs button').length).toBe(2);
  });

  it('switches to editing on the same page, using existing PlatformStore update', async () => {
    const { fixture, store } = setup();
    await fixture.whenStable();
    const update = vi.spyOn(store, 'update');
    fixture.componentInstance.startEdit();
    await fixture.whenStable();
    expect(fixture.componentInstance.mode()).toBe('edit');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('u-field')).not.toBeNull();
    fixture.componentInstance.update(form.sections[0].fields[0], 'Nowe imię');
    expect(update).toHaveBeenCalledWith('name', 'Nowe imię');
    expect(store.active()?.answers['name']).toBe('Nowe imię');
    // The existing demo store persists each edit immediately.
    expect(store.dirty()).toBe(false);
    fixture.componentInstance.backToView();
    expect(fixture.componentInstance.mode()).toBe('view');
  });

  it('refuses edit when blocked or accepted in preview, even on unlocked backend record', async () => {
    const { fixture, preview } = setup();
    await fixture.whenStable();
    preview.locked.set(true);
    await fixture.whenStable();
    fixture.componentInstance.startEdit();
    expect(fixture.componentInstance.mode()).toBe('view');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Postać zablokowana');
    preview.locked.set(false);
    preview.setCharacter('accepted');
    await fixture.whenStable();
    fixture.componentInstance.startEdit();
    expect(fixture.componentInstance.mode()).toBe('view');
    const edit = (fixture.nativeElement as HTMLElement).querySelectorAll('.my-character-tabs button')[1] as HTMLButtonElement;
    expect(edit.disabled).toBe(true);
  });

  it('does not show form contents to a guest preview without a real signed-in user', async () => {
    const { fixture, preview } = setup();
    preview.setRole('guest');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Zaloguj się, aby zobaczyć swoją postać');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Bogdan');
  });
});
