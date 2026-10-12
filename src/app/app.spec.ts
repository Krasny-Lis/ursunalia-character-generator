import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withHashLocation } from '@angular/router';
import { describe, expect, it, beforeEach } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';

describe('Platform App Shell v24', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports:[App],
      providers:[provideHttpClient(), provideHttpClientTesting(), provideRouter(routes, withHashLocation())],
    }).compileComponents();
  });

  it('pokazuje markę i router-outlet niezależnie od modułów', () => {
    const fixture=TestBed.createComponent(App);
    fixture.detectChanges();
    const root=fixture.nativeElement as HTMLElement;
    expect(root.querySelector('router-outlet')).not.toBeNull();
    expect(root.querySelector('.platform-brand')?.textContent).toContain('URSUNALIA');
  });

  it('posiada trasy wydarzenia i działającego generatora', () => {
    expect(routes.some(route => route.path === '')).toBe(true);
    expect(routes.some(route => route.path === 'zgloszenie-postaci')).toBe(true);
  });
});
