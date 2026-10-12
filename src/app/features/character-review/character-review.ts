import { Component, ElementRef, HostListener, Input, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import type { PillarId } from '../../core/models/character.model';
import { CatalogService } from '../../core/services/catalog.service';
import { CharacterStore } from '../../core/storage/character-store.service';
import { validateCharacter } from '../../core/validation/character-validation';
import { calculateCatalogInfoPosition } from './catalog-info-layout';
import { CharacterIdentityEditor } from '../character-identity-editor/character-identity-editor';
import { CharacterCatalogEditor } from '../character-catalog-editor/character-catalog-editor';
import { CharacterStoryEditor } from '../character-story-editor/character-story-editor';
import { CharacterRelationsEditor } from '../character-relations-editor/character-relations-editor';
import { CharacterPreferencesEditor } from '../character-preferences-editor/character-preferences-editor';

type SectionId = 'identity' | 'traits' | 'hooks' | 'story' | 'relations' | 'preferences';
type InfoCatalogKey = 'roles' | 'regions' | 'residencies' | 'cultures' | 'traits' | 'hooks' | 'pillars' | 'gameStyles' | 'relationOpenness';
type ShortStoryField = 'goal' | 'obstacle' | 'presenceReason' | 'stakes';
interface InfoEntry { id: string; name: string; description: string; secondary?: string; }

const INFO_TITLES: Record<InfoCatalogKey, string> = {
  roles: 'Role społeczne', regions: 'Regiony pochodzenia', residencies: 'Status na Ziemiach Braci',
  cultures: 'Kultury Kisleva', traits: 'Cechy charakteru', hooks: 'Haki fabularne',
  pillars: 'Filary rozgrywki', gameStyles: 'Style gry', relationOpenness: 'Otwartość na nowe relacje',
};

@Component({
  selector: 'app-character-review',
  standalone: true,
  imports: [CharacterIdentityEditor, CharacterCatalogEditor, CharacterStoryEditor, CharacterRelationsEditor, CharacterPreferencesEditor],
  templateUrl: './character-review.html',
  styleUrl: './character-review.scss',
})
export class CharacterReview implements OnDestroy {
  protected readonly store = inject(CharacterStore);
  // Na pierwszym otwarciu zgłoszenia pokazujemy Dane postaci, resztę jako krótkie podsumowania.
  protected readonly collapsed = signal<Partial<Record<SectionId, boolean>>>({
    identity: false,
    traits: true,
    hooks: true,
    story: true,
    relations: true,
    preferences: true,
  });
  protected readonly highlightedField = signal<string | null>(null);
  protected readonly infoKey = signal<InfoCatalogKey | null>(null);
  protected readonly infoMobile = signal(false);
  protected readonly infoPosition = signal({ top: 16, left: 16, maxHeight: 440 });
  private infoAnchor?: HTMLElement;
  private readonly infoPopover = viewChild<ElementRef<HTMLElement>>('infoPopover');
  private readonly catalogDialog = viewChild<ElementRef<HTMLDialogElement>>('catalogDialog');
  private highlightTimeout?: ReturnType<typeof setTimeout>;
  private jumpTimeout?: ReturnType<typeof setTimeout>;


  /** Ukryty formularz zachowuje edycję, ale nie może trzymać otwartego popovera. */
  @Input() set inactive(hidden: boolean) {
    if (hidden) this.closeInfo();
  }


  protected readonly activeCharacter = this.store.activeCharacter;
  protected readonly catalogs = toSignal(inject(CatalogService).catalogs$, { initialValue: null });

  protected readonly selectedTraits = computed(() => {
    const c = this.activeCharacter();
    const data = this.catalogs();
    return c && data ? data.traits.filter((entry) => c.traitIds.includes(entry.id)) : [];
  });
  protected readonly selectedHooks = computed(() => {
    const c = this.activeCharacter();
    const data = this.catalogs();
    return c && data ? data.hooks.filter((entry) => c.hookIds.includes(entry.id)) : [];
  });
  protected readonly selectedStyle = computed(() =>
    this.catalogs()?.gameStyles.find((entry) => entry.id === this.activeCharacter()?.gameplayStyle)
  );
  // Czysta walidacja – wynik jest przeliczany po każdej zmianie aktywnej postaci.
  protected readonly validation = computed(() => {
    const character = this.activeCharacter();
    const data = this.catalogs();
    return character && data ? validateCharacter(character, data) : null;
  });
  protected readonly requiredSections = computed(() => this.validation()?.required ?? []);
  protected readonly optionalIssues = computed(() => this.validation()?.optionalIssues ?? []);
  protected readonly readyCount = computed(() => this.validation()?.readyCount ?? 0);
  protected readonly incompleteSections = computed(() => this.requiredSections().filter(item => !item.ready));
  protected readonly completedSections = computed(() => this.requiredSections().filter(item => item.ready));
  protected readonly infoTitle = computed(() => INFO_TITLES[this.infoKey() ?? 'roles']);
  protected readonly infoEntries = computed<InfoEntry[]>(() => {
    const data = this.catalogs();
    const key = this.infoKey();
    if (!data || !key) return [];
    const items = data[key];
    return items.map((item) => ({
      id: item.id, name: item.name, description: item.description,
      secondary: 'subtitle' in item && typeof item.subtitle === 'string' ? item.subtitle
        : 'tagline' in item && typeof item.tagline === 'string' ? item.tagline : undefined,
    }));
  });

  protected isCollapsed(id: SectionId): boolean {
    return this.collapsed()[id] === true;
  }

  protected toggleSection(id: SectionId): void {
    this.collapsed.update(current => ({ ...current, [id]: !current[id] }));
  }

  /** Informacja w zwiniętej sekcji – zawsze na podstawie aktywnej postaci. */
  protected sectionPreview(id: SectionId): string {
    const character = this.activeCharacter();
    if (!character) return 'Nie wybrano postaci';
    const data = this.catalogs();
    switch (id) {
      case 'identity': {
        const culture = data?.cultures.find(item => item.id === character.cultureId)?.name;
        const role = data?.roles.find(item => item.id === character.roleId)?.name;
        return [character.name || 'Brak nazwy', culture, role].filter(Boolean).join(' · ');
      }
      case 'traits': {
        const names = this.selectedTraits().map(item => item.name);
        if (!names.length) return 'Nie wybrano cech · opcjonalne';
        return `${names.length} wybrane · ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` i ${names.length - 3} więcej` : ''}`;
      }
      case 'hooks': {
        const names = this.selectedHooks().map(item => item.name);
        if (!names.length) return 'Nie wybrano haków · opcjonalne';
        return `${names.length} wybrane · ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` i ${names.length - 3} więcej` : ''}`;
      }
      case 'story': {
        const length = character.story.history.trim().length;
        const otherCount = ['goal', 'obstacle', 'presenceReason', 'stakes']
          .filter(key => !!character.story[key as ShortStoryField].trim()).length;
        return `Biografia: ${length} znaków${length < 500 ? ` · brakuje ${500 - length}` : ' · gotowa'} · Krótkie odpowiedzi: ${otherCount}/4`;
      }
      case 'relations':
        return `${character.relations.length} ${character.relations.length === 1 ? 'znajomość' : 'znajomości'} · opcjonalne`;
      case 'preferences': {
        const count = data?.pillars.filter(item => {
          const rating = character.pillarRatings[item.id as PillarId];
          return rating !== undefined && Number.isInteger(rating) && rating >= 1 && rating <= 5;
        }).length ?? 0;
        const style = this.selectedStyle()?.name ?? 'nie wybrano';
        return `Filary: ${count}/6 ocen · Styl gry: ${style}`;
      }
    }
  }

  protected acknowledgeHighlight(id: string): void {
    if (this.highlightedField() !== id) return;
    this.clearHighlight();
  }

  private clearHighlight(): void {
    if (this.highlightTimeout) clearTimeout(this.highlightTimeout);
    this.highlightTimeout = undefined;
    this.highlightedField.set(null);
  }

  protected shortLabel(id: string, fullLabel: string): string {
    const labels: Record<string, string> = {
      name: 'Nazwa', role: 'Rola i zawód', region: 'Region', residency: 'Status',
      culture: 'Kultura', history: 'Biografia', pillars: '6 filarów', gameplay: 'Styl gry',
    };
    return labels[id] ?? fullLabel;
  }

  protected shortDetail(id: string): string {
    const c = this.activeCharacter();
    if (!c) return 'Uzupełnij';
    switch (id) {
      case 'name': return c.name.length > 160 ? 'Maks. 160 znaków' : 'Wpisz nazwę';
      case 'role': return c.roleId ? 'Podaj zawód' : 'Wybierz rolę';
      case 'region': return 'Wybierz region';
      case 'residency': return 'Wybierz status';
      case 'culture': return 'Wybierz kulturę';
      case 'history': return `Brakuje ${Math.max(0, 500 - c.story.history.trim().length)} znaków`;
      case 'pillars': {
        const missing = (this.catalogs()?.pillars ?? []).filter((p) => {
          const score = c.pillarRatings[p.id as PillarId];
          return typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5;
        }).length;
        return `Brak ocen: ${missing}`;
      }
      case 'gameplay': return 'Wybierz styl';
      default: {
        const text = c.story[id as ShortStoryField];
        return typeof text === 'string' ? `Skróć o ${Math.max(0, text.length - 400)} znaków` : 'Popraw odpowiedź';
      }
    }
  }

  /** Kliknięcie braku w panelu: rozwijamy sekcję, trafiamy w pole, podświetlamy maks. 2 sekundy. */
  protected scrollToIssue(id: string): void {
    const section: SectionId = ['name', 'role', 'region', 'residency', 'culture'].includes(id) ? 'identity'
      : ['history', 'goal', 'obstacle', 'presenceReason', 'stakes'].includes(id) ? 'story'
      : 'preferences';
    const field = id === 'role' && this.activeCharacter()?.roleId ? 'occupation' : id;
    const needsExpansion = this.isCollapsed(section);
    this.collapsed.update((current) => ({ ...current, [section]: false }));
    this.clearHighlight();
    if (this.jumpTimeout) clearTimeout(this.jumpTimeout);
    this.highlightedField.set(field);
    this.highlightTimeout = setTimeout(() => this.clearHighlight(), 2000);
    // Nie przewijamy do pola dopóki sekcja nie zakończy rozwijania.
    // To zapobiega skokom pozycji na długich formularzach.
    if (typeof window !== 'undefined') {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.jumpTimeout = setTimeout(() => {
        const target = document.querySelector(`[data-validation-field="${field}"]`);
        (target ?? document.getElementById(section))?.scrollIntoView({
          behavior: reduced ? 'auto' : 'smooth', block: 'start',
        });
      }, needsExpansion && !reduced ? 430 : 0);
    }
  }

  protected openInfo(key: InfoCatalogKey, event: MouseEvent): void {
    if (this.infoKey() === key) { this.closeInfo(); return; }
    this.infoAnchor = event.currentTarget as HTMLElement;
    const compact = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
    const room = this.infoBottomBoundary() - 28;
    // Przy niewielkiej dostępnej wysokości czytelniejszy jest modal.
    this.infoMobile.set(compact || room < 260);
    this.infoKey.set(key);
    if (this.infoMobile()) {
      this.catalogDialog()?.nativeElement.showModal();
    } else {
      this.positionInfo();
      this.infoPopover()?.nativeElement.showPopover();
      // Po otwarciu możemy poznać rzeczywistą wysokość krótszych katalogów.
      this.positionInfo();
    }
  }

  /**
   * Górne/dolne ograniczenie okienka w CSS pikselach viewportu.
   * Używamy pozycji faktycznej belki, zamiast przewidywać jej wysokość.
   */
  private infoBottomBoundary(): number {
    if (typeof window === 'undefined') return 600;
    const viewportBottom = Math.min(window.innerHeight, document.documentElement.clientHeight);
    const dock = document.querySelector<HTMLElement>('.wizard-dock');
    const dockTop = dock?.getBoundingClientRect().top;
    return Math.max(0, Math.min(viewportBottom, dockTop ?? viewportBottom) - 12);
  }

  private positionInfo(): void {
    if (!this.infoAnchor || typeof window === 'undefined') return;
    const anchor = this.infoAnchor.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    this.infoPosition.set(calculateCatalogInfoPosition(
      anchor, this.infoEntries().length, viewportWidth, this.infoBottomBoundary(),
    ));
  }

  @HostListener('window:resize')
  protected onInfoResize(): void {
    if (!this.infoKey() || this.infoMobile()) return;
    if (window.matchMedia('(max-width: 720px)').matches || this.infoBottomBoundary() - 12 < 260) this.closeInfo();
    else this.positionInfo();
  }

  @HostListener('window:scroll')
  protected onInfoScroll(): void {
    if (this.infoKey() && !this.infoMobile()) this.positionInfo();
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onOutsideInfo(event: PointerEvent): void {
    if (!this.infoKey() || this.infoMobile()) return;
    const target = event.target as Node;
    if (this.infoAnchor?.contains(target) || this.infoPopover()?.nativeElement.contains(target)) return;
    this.closeInfo();
  }

  @HostListener('document:keydown.escape')
  protected onEscapeInfo(): void { this.closeInfo(); }

  protected closeInfo(): void {
    const dialog = this.catalogDialog()?.nativeElement;
    if (dialog?.open) dialog.close();
    const popover = this.infoPopover()?.nativeElement;
    if (popover?.matches(':popover-open')) popover.hidePopover();
    this.infoKey.set(null);
    this.infoAnchor = undefined;
  }

  protected onInfoClosed(): void {
    this.infoKey.set(null);
    this.infoAnchor = undefined;
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeInfo();
  }

  ngOnDestroy(): void { this.clearHighlight(); if (this.jumpTimeout) clearTimeout(this.jumpTimeout); this.closeInfo(); }

}
