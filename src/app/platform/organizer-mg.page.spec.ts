import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { OrganizerPage } from './organizer.page';
import { PlatformStore } from './platform.store';
import type { Application, FormDefinition, GameEvent, Seed } from './models';
import { routes } from '../app.routes';

const event: GameEvent = {
  id:'ursunalia-2027', name:'Ursunalia', subtitle:'',date:'22–24 kwietnia 2027',
  location:'',locationNote:'',description:'',status:'',registrationsOpen:true,
};
const form: FormDefinition = {
  id:'character-2027',eventId:event.id,revision:1,status:'published',title:'Postać',sections:[],
};
const submitted: Application = {
  id:'char-submitted',form,kind:'character',eventId:event.id,revision:1,
  answers:{name:'Anton'},status:'submitted',updatedAt:'2026-10-14T12:00:00Z',
  userName:'Gracz testowy',userEmail:'private@example.invalid',
};
const draft: Application = {...submitted,id:'char-draft',status:'draft',answers:{name:'Niewysłany'}};

describe('Panel MG – prywatność i szkice', () => {
  it('shows only submitted characters without exposing contact email or survey catalog', async () => {
    TestBed.configureTestingModule({imports:[OrganizerPage],providers:[provideRouter(routes)]});
    const store=TestBed.inject(PlatformStore);
    store.mode.set('server');
    store.seed.set({event,forms:[form],example:{}} satisfies Seed);
    store.eventGrants.set([{eventId:event.id,role:'gm'}]);
    vi.spyOn(store,'request').mockResolvedValue([draft,submitted]);
    const fixture=TestBed.createComponent(OrganizerPage);
    await fixture.whenStable();
    const root=fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.review-item').length).toBe(1);
    expect(root.textContent).toContain('Anton');
    expect(root.textContent).not.toContain('Niewysłany');
    expect(root.textContent).not.toContain('private@example.invalid');
    expect(root.querySelector('.survey-cards')).toBeNull();
    expect(root.querySelector('a[href*="/organizator/ankiety/edytor"]')).toBeNull();
    expect(root.querySelector('a[target="_blank"]')).not.toBeNull();
    fixture.componentInstance.select(submitted);
    await fixture.whenStable();
    expect(root.querySelector('.review-detail')).not.toBeNull();
    expect(root.textContent).not.toContain('private@example.invalid');
  });

  it('shows no personal email to a MG who is organizer of an unrelated event', async () => {
    TestBed.configureTestingModule({imports:[OrganizerPage],providers:[provideRouter(routes)]});
    const store=TestBed.inject(PlatformStore);
    store.mode.set('server');
    store.seed.set({event,forms:[form],example:{}} satisfies Seed);
    store.eventGrants.set([{eventId:event.id,role:'gm'},{eventId:'other',role:'organizer'}]);
    vi.spyOn(store,'request').mockResolvedValue([submitted]);
    const fixture=TestBed.createComponent(OrganizerPage);
    await fixture.whenStable();
    fixture.componentInstance.select(submitted);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('private@example.invalid');
  });
});
