import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-module-unavailable',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="module-unavailable">
      <h1>Moduł niedostępny</h1>
      <p>Ta funkcja nie została jeszcze włączona lub jest dostępna tylko w środowisku deweloperskim.</p>
      <a routerLink="/">← Wróć do wydarzenia</a>
    </main>
  `,
  styles: [`
    .module-unavailable { max-width:900px; margin:auto; padding:80px 28px; }
    h1 { color:#f0dec0; font: 400 42px Georgia,serif; }
    p { color:#bbcbdb; line-height:1.7; }
    a { color:#ebcf99; }
  `],
})
export class ModuleUnavailablePage {}
