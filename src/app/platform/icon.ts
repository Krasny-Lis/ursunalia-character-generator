import { Component, input, computed } from '@angular/core';
const paths: Record<string, string> = {
  search: 'm21 21-5-5 M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'm6 6 12 12M18 6 6 18',
  back: 'm10 5-7 7 7 7M3 12h18',
  next: 'm14 5 7 7-7 7M21 12H3',
  edit: 'm16 3 5 5-13 13H3v-5L16 3m-3 3 5 5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2M7 3v6h10V3M7 21v-8h10v8',
  send: 'm22 2-7 20-4-9L2 9 22 2 11 13',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  check: 'm5 12 4 4L19 6',
  chevron: 'm6 9 6 6 6-6',
  up: 'm6 14 6-6 6 6',
  plus: 'M12 4v16M4 12h16',
  user: 'M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-3a8 8 0 0 1 16 0v3',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  star: 'm12 2 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1 3-7',
  book: 'M12 5C8 2 4 3 2 4v17c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-6-2-10 1v16',
  people:
    'M10 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M2 21v-4a5 5 0 0 1 10 0v4M20 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M14 13a5 5 0 0 1 8 4v4',
  shield: 'm12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4m-5 10 3 3 7-7',
  file: 'M14 2H4v20h16V8l-6-6v6h6M8 13h8M8 17h8',
  calendar: 'M3 5h18v17H3V5M7 2v6M17 2v6M3 11h18',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 16h12l1-16M10 10v8M14 10v8',
  copy: 'M8 8h13v13H8V8M16 4V2H2v14h2',
  grip: 'M8 4h.01M16 4h.01M8 12h.01M16 12h.01M8 20h.01M16 20h.01',
  info: 'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  feather: 'M20 2C8 0 3 12 6 18 12 21 24 10 20 2M2 22 17 7M6 18v-6M10 14h6',
  sword: 'm3 21 4-4m-2-4 6 6M8 16l13-13-5 1L6 14m-3-11 13 13m-3 3 6-6m-2 4 4 4',
  grid: 'M3 3h7v7H3V3M14 3h7v7h-7V3M3 14h7v7H3v-7M14 14h7v7h-7v-7',
  list: 'M8 5h14M8 12h14M8 19h14M2 5h.01M2 12h.01M2 19h.01',
  radio: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  checkbox: 'M3 3h18v18H3V3m4 9 4 4 7-8',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10 21h4',
};
@Component({
  selector: 'u-icon',
  standalone: true,
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path [attr.d]="path()" />
  </svg>`,
  styles: [
    `
      :host {
        display: inline-flex;
        width: 1.25em;
        height: 1.25em;
        flex-shrink: 0;
        vertical-align: middle;
      }
      svg {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class Icon {
  name = input('star');
  path = computed(() => paths[this.name()] ?? paths['star']);
}
