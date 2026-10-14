import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { App } from './app';
import { PlatformStore } from './platform/platform.store';
import { routes } from './app.routes';
describe('Royal Manuscript application shell', () => {
  it('keeps the brand, mobile navigation and loading state accessible before bootstrap', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes)] });
    const store = TestBed.inject(PlatformStore);
    vi.spyOn(store, 'initialize').mockResolvedValue();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.platform-brand')?.textContent).toContain('URSUNALIA');
    const toggle = root.querySelector('.menu-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Otwieramy księgę');
    store.ready.set(true);
    await fixture.whenStable();
    expect(root.querySelector('router-outlet')).not.toBeNull();
  });
});

it('the surveys link follows the selected visible event and opens its form section, without a hard-coded Ursunalia target', async () => {
  TestBed.configureTestingModule({ imports:[App],providers:[provideRouter(routes)] });
  const store=TestBed.inject(PlatformStore);vi.spyOn(store,'initialize').mockResolvedValue();
  const event={id:'beta',name:'Noc latarni',subtitle:'',date:'17.05.2028',location:'Gdańsk',locationNote:'',description:'Własny opis',status:'Zapisy otwarte'};
  store.mode.set('server');store.events.set([event]);
  const fixture=TestBed.createComponent(App);await fixture.whenStable();
  const surveys=()=>Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav a')).find(a=>a.textContent?.trim()==='Ankiety')!;
  expect(surveys().getAttribute('href')).toBe('/wydarzenie/beta#ankiety');
  store.events.set([event,{...event,id:'gamma',name:'Drugi świat'}]);store.selectEvent('gamma');await fixture.whenStable();
  expect(surveys().getAttribute('href')).toBe('/wydarzenie/gamma#ankiety');
  store.events.set([event]);await fixture.whenStable();expect(surveys().getAttribute('href')).toBe('/wydarzenie/beta#ankiety');
  store.events.set([]);await fixture.whenStable();expect(surveys().getAttribute('href')).toBe('/#ankiety');
});
