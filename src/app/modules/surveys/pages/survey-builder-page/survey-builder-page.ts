import { Component, HostListener, OnDestroy, computed, signal } from '@angular/core';
import { DragDropModule, type CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { RouterLink } from '@angular/router';
import type { SurveyDefinition, SurveyField, SurveyOption, SurveySection } from '../../models/survey.model';
import { DEMO_SURVEY } from '../../data/demo-survey';
import { SurveyRenderer } from '../../renderer/survey-renderer';
import { validateSurveyDefinition } from '../../validation/survey-validation';
import {
  FIELD_TYPES, type EditableFieldType, createField, newId, parseImportedSurvey,
  moveFieldByIndex, updateField, updateSection,
} from '../../builder/survey-builder.logic';

const DRAFT_KEY = 'ursunalia:surveys:builder:v26';
type Selection = { sectionId: string; fieldId?: string };

/** Local, dev-only questionnaire builder. No participant responses and no HTTP. */
@Component({
  selector: 'app-survey-builder-page',
  standalone: true,
  imports: [RouterLink, SurveyRenderer, DragDropModule],
  templateUrl: './survey-builder-page.html',
})
export class SurveyBuilderPage implements OnDestroy {
  protected readonly fieldTypes = FIELD_TYPES;
  protected readonly survey = signal<SurveyDefinition>(this.restoreDraft());
  protected readonly selected = signal<Selection | null>(null);
  protected readonly mode = signal<'edit' | 'preview'>('edit');
  protected readonly problems = computed(() => validateSurveyDefinition(this.survey()));
  protected readonly notice = signal('Szkic roboczy – zapis tylko w tej przeglądarce.');
  protected readonly importOpen = signal(false);
  protected readonly importText = signal('');
  protected readonly importError = signal('');
  protected readonly storageAvailable = signal(true);
  // Menu dodawania zamiast bocznej palety elementow.
  protected readonly addMenuOpen = signal(false);
  protected readonly insertSectionId = signal<string | null>(null);
  // Widoczny cel przeciagania; tekst w polach nie staje sie uchwytem.
  protected readonly dragging = signal(false);
  // Editor-only view state; does not alter whether players can collapse a section.
  protected readonly collapsedSections = signal<ReadonlySet<string>>(new Set<string>());
  protected readonly fieldListIds = computed(() => this.survey().sections
    .filter(section => !this.collapsedSections().has(section.id))
    .map(section => `survey-fields-${section.id}`));

  protected isSectionCollapsed(sectionId: string): boolean {
    return this.collapsedSections().has(sectionId);
  }

  protected toggleSectionCollapsed(sectionId: string): void {
    this.collapsedSections.update(current => {
      const updated = new Set(current);
      if (updated.has(sectionId)) updated.delete(sectionId);
      else updated.add(sectionId);
      return updated;
    });
    if (this.isSectionCollapsed(sectionId) && this.selected()?.sectionId === sectionId) {
      this.selected.set(null);
    }
  }
  private selectionScrollFrame?: number;
  private noticeTimeout?: ReturnType<typeof setTimeout>;

  protected readonly selectedSection = computed(() =>
    this.survey().sections.find(s => s.id === this.selected()?.sectionId) ?? null,
  );
  protected readonly selectedField = computed(() => {
    const selected = this.selected();
    return selected?.fieldId ? this.selectedSection()?.fields.find(f => f.id === selected.fieldId) ?? null : null;
  });
  protected readonly totalFields = computed(() => this.survey().sections.reduce((sum, section) => sum + section.fields.length, 0));

  ngOnDestroy(): void {
    if (this.noticeTimeout) clearTimeout(this.noticeTimeout);
    if (this.selectionScrollFrame !== undefined && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.selectionScrollFrame);
    }
  }

  /** Clicks outside cards close the active editor, as in Google Forms. */
  @HostListener('document:pointerdown', ['$event'])
  protected onOutsidePointer(event: PointerEvent): void {
    if (this.mode() !== 'edit' || !this.selected()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.editable-field, .section-head, .builder-toolbox')) return;
    this.selected.set(null);
  }

  protected selectSection(id: string): void {
    if (this.isSelected(id)) return;
    this.selected.set({ sectionId: id });
    this.scrollToSelected('section', id);
  }
  protected selectField(sectionId: string, fieldId: string): void {
    if (this.isSelected(sectionId, fieldId)) return;
    this.selected.set({ sectionId, fieldId });
    this.scrollToSelected('field', fieldId);
  }
  /** After the previous card collapses, align the newly expanded one below the site header. */
  private scrollToSelected(kind: 'section' | 'field', id: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') return;
    if (this.selectionScrollFrame !== undefined) cancelAnimationFrame(this.selectionScrollFrame);
    this.selectionScrollFrame = requestAnimationFrame(() => {
      this.selectionScrollFrame = requestAnimationFrame(() => {
        const attr = kind === 'section' ? 'data-section-id' : 'data-field-id';
        const target = Array.from(document.querySelectorAll<HTMLElement>(`[${attr}]`))
          .find(element => element.getAttribute(attr) === id);
        const scrollTarget = kind === 'section' ? target?.querySelector<HTMLElement>('.section-head') : target;
        if (scrollTarget && typeof scrollTarget.getBoundingClientRect === 'function') {
          const top = scrollTarget.getBoundingClientRect().top;
          // Do not scroll if already at the right position. Avoid a jump while editing text.
          if (top < 92 || top > 155) {
            const offset = window.scrollY + top - 100;
            try { window.scrollTo({ top: Math.max(0, offset), behavior: 'instant' }); }
            catch { /* jsdom may not implement scrolling. */ }
          }
        }
        this.selectionScrollFrame = undefined;
      });
    });
  }

  protected isSelected(sectionId: string, fieldId?: string): boolean {
    const current = this.selected();
    return current?.sectionId === sectionId && current.fieldId === fieldId;
  }
  protected typeLabel(type: SurveyField['type']): string { return this.fieldTypes.find(f => f.id === type)?.label ?? type; }

  private save(next: SurveyDefinition): void {
    this.survey.set(next);
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); this.storageAvailable.set(true); }
    catch { this.storageAvailable.set(false); this.notice.set('Uwaga: zapis w przeglądarce jest niedostępny. Wyeksportuj plik JSON.'); }
  }

  private restoreDraft(): SurveyDefinition {
    if (typeof localStorage !== 'undefined') {
      try {
        const json = localStorage.getItem(DRAFT_KEY);
        if (json) return parseImportedSurvey(json, false);
      } catch { /* Malformed/old local draft: use demo. */ }
    }
    return structuredClone(DEMO_SURVEY);
  }

  private showNotice(message: string): void {
    this.notice.set(message);
    if (this.noticeTimeout) clearTimeout(this.noticeTimeout);
    this.noticeTimeout = setTimeout(() => this.notice.set('Szkic roboczy – zapis tylko w tej przeglądarce.'), 5500);
  }

  protected editMeta(key: 'title' | 'description', event: Event): void {
    this.save({ ...this.survey(), [key]: (event.target as HTMLInputElement).value });
  }
  protected showAddMenu(sectionId?: string): void {
    const target = sectionId ?? this.selected()?.sectionId ?? this.survey().sections.at(-1)?.id ?? null;
    const sameTarget = this.insertSectionId() === target;
    this.insertSectionId.set(target);
    this.addMenuOpen.set(!this.addMenuOpen() || !sameTarget);
  }
  protected addSection(): void {
    const section: SurveySection = { id: newId('section'), title: 'Nowa sekcja', collapsible: true, fields: [] };
    this.save({ ...this.survey(), sections: [...this.survey().sections, section] });
    this.selectSection(section.id);
    this.addMenuOpen.set(false);
  }
  protected editSection(key: 'title' | 'description', event: Event): void {
    const id = this.selected()?.sectionId;
    if (id) this.save(updateSection(this.survey(), id, { [key]: (event.target as HTMLInputElement).value }));
  }
  protected toggleCollapsible(event: Event): void {
    const id = this.selected()?.sectionId;
    if (id) this.save(updateSection(this.survey(), id, { collapsible: (event.target as HTMLInputElement).checked }));
  }
  protected removeSection(id: string): void {
    const section = this.survey().sections.find(s => s.id === id);
    if (!section || !confirm(`Usunąć sekcję „${section.title}” wraz ze wszystkimi jej pytaniami?`)) return;
    this.save({ ...this.survey(), sections: this.survey().sections.filter(s => s.id !== id) });
    if (this.selected()?.sectionId === id) this.selected.set(null);
  }
  protected shiftSection(id: string, direction: -1 | 1): void {
    const sections = [...this.survey().sections];
    const index = sections.findIndex(s => s.id === id);
    if (index < 0 || index + direction < 0 || index + direction >= sections.length) return;
    [sections[index], sections[index + direction]] = [sections[index + direction], sections[index]];
    this.save({ ...this.survey(), sections });
  }

  /** Sort the full sections only when the top section handle is dragged. */
  protected dropSection(event: CdkDragDrop<SurveySection[]>): void {
    this.dragging.set(false);
    if (event.previousIndex === event.currentIndex) return;
    const sections = [...this.survey().sections];
    if (event.previousIndex < 0 || event.previousIndex >= sections.length ||
        event.currentIndex < 0 || event.currentIndex >= sections.length) return;
    moveItemInArray(sections, event.previousIndex, event.currentIndex);
    this.save({ ...this.survey(), sections });
  }

  /** Zmiana typu nie zmienia ID pytania ani jego pozycji w ankiecie. */
  protected changeFieldType(event: Event): void {
    const selected = this.selected();
    const field = this.selectedField();
    if (!selected?.fieldId || !field) return;
    const type = (event.target as HTMLSelectElement).value as EditableFieldType;
    if (field.type === type || !this.fieldTypes.some(entry => entry.id === type)) return;
    const fresh = createField(type);
    let next: SurveyField;
    if (type === 'info') {
      next = { id: field.id, type: 'info', title: field.type === 'info' ? field.title : field.label,
        paragraphs: field.type === 'info' ? field.paragraphs : [field.description ?? ''] };
    } else {
      const label = field.type === 'info' ? field.title : field.label;
      const preserved = field.type === 'info' ? {} : {
        required: field.required,
        description: field.description,
        help: field.help,
      };
      next = { ...fresh, ...preserved, id: field.id, label } as SurveyField;
      if ((type === 'single-choice' || type === 'multi-choice') &&
          (field.type === 'single-choice' || field.type === 'multi-choice')) {
        next = { ...next, options: field.options,
          appearance: type === 'multi-choice' && field.appearance === 'select' ? 'radio' : field.appearance } as SurveyField;
      }
    }
    this.save({ ...this.survey(), sections: this.survey().sections.map(section =>
      section.id !== selected.sectionId ? section : {
        ...section, fields: section.fields.map(item => item.id === field.id ? next : item),
      },
    ) });
  }

  protected addField(type: EditableFieldType, sectionId?: string): void {
    let id = sectionId ?? this.selected()?.sectionId ?? this.survey().sections.at(-1)?.id;
    if (!id || !this.survey().sections.some(s => s.id === id)) {
      const section: SurveySection = { id: newId('section'), title: 'Nowa sekcja', collapsible: true, fields: [] };
      this.save({ ...this.survey(), sections: [...this.survey().sections, section] });
      id = section.id;
    }
    const field = createField(type);
    const previous = this.selected();
    this.save({ ...this.survey(), sections: this.survey().sections.map(s => {
      if (s.id !== id) return s;
      const index = previous?.sectionId === id && previous.fieldId
        ? s.fields.findIndex(f => f.id === previous.fieldId) : -1;
      const fields = [...s.fields];
      fields.splice(index >= 0 ? index + 1 : fields.length, 0, field);
      return { ...s, fields };
    }) });
    this.selectField(id, field.id);
    this.addMenuOpen.set(false);
  }
  protected removeField(sectionId: string, fieldId: string): void {
    const field = this.survey().sections.find(s => s.id === sectionId)?.fields.find(f => f.id === fieldId);
    if (!field || !confirm(`Usunąć pytanie „${field.type === 'info' ? field.title : field.label}”?`)) return;
    this.save({ ...this.survey(), sections: this.survey().sections.map(s => s.id === sectionId ? { ...s, fields: s.fields.filter(f => f.id !== fieldId) } : s) });
    if (this.selected()?.fieldId === fieldId) this.selectSection(sectionId);
  }
  protected duplicateField(sectionId: string, fieldId: string): void {
    const original = this.survey().sections.find(s => s.id === sectionId)?.fields.find(f => f.id === fieldId);
    if (!original) return;
    const copy = structuredClone(original);
    copy.id = newId('field');
    if (copy.type === 'single-choice' || copy.type === 'multi-choice') {
      copy.options = copy.options.map(o => ({ ...o, id: newId('option') }));
    }
    this.save({ ...this.survey(), sections: this.survey().sections.map(s => s.id === sectionId ? { ...s, fields: [
      ...s.fields.slice(0, s.fields.findIndex(f => f.id === fieldId) + 1), copy,
      ...s.fields.slice(s.fields.findIndex(f => f.id === fieldId) + 1),
    ] } : s) });
    this.selectField(sectionId, copy.id);
  }
  protected shiftField(sectionId: string, fieldId: string, delta: -1 | 1): void {
    const sections = this.survey().sections;
    const fields = sections.find(s => s.id === sectionId)?.fields;
    if (!fields) return;
    const index = fields.findIndex(f => f.id === fieldId);
    if (index < 0 || index + delta < 0 || index + delta >= fields.length) return;
    const copy = [...fields];
    [copy[index], copy[index + delta]] = [copy[index + delta], copy[index]];
    this.save({ ...this.survey(), sections: sections.map(s => s.id === sectionId ? { ...s, fields: copy } : s) });
  }

  protected editFieldText(key: string, event: Event): void {
    this.patchSelectedField({ [key]: (event.target as HTMLInputElement | HTMLTextAreaElement).value });
  }
  protected editFieldRequired(event: Event): void {
    this.patchSelectedField({ required: (event.target as HTMLInputElement).checked });
  }
  protected editFieldNumber(key: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const next = value.trim() ? Number(value) : (key === 'min' ? 1 : key === 'max' ? 5 : undefined);
    this.patchSelectedField({ [key]: next });
  }
  protected editFieldAppearance(event: Event): void {
    this.patchSelectedField({ appearance: (event.target as HTMLSelectElement).value });
  }
  private patchSelectedField(patch: Record<string, unknown>): void {
    const selected = this.selected();
    if (selected?.fieldId) this.save(updateField(this.survey(), selected.sectionId, selected.fieldId, patch));
  }
  protected editInfoParagraphs(event: Event): void {
    this.patchSelectedField({ paragraphs: (event.target as HTMLTextAreaElement).value.split('\n') });
  }
  protected editHelpEnabled(event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.patchSelectedField({ help: enabled ? { title: 'Więcej informacji', paragraphs: ['Wpisz objaśnienie.'] } : undefined });
  }
  protected editHelpTitle(event: Event): void {
    const field = this.selectedField();
    if (field && field.type !== 'info' && field.help) this.patchSelectedField({ help: { ...field.help, title: (event.target as HTMLInputElement).value } });
  }
  protected editHelpParagraphs(event: Event): void {
    const field = this.selectedField();
    if (field && field.type !== 'info' && field.help) this.patchSelectedField({ help: { ...field.help, paragraphs: (event.target as HTMLTextAreaElement).value.split('\n') } });
  }
  protected editOption(optionId: string, key: 'label' | 'description', event: Event): void {
    const field = this.selectedField();
    if (field?.type === 'single-choice' || field?.type === 'multi-choice') {
      this.patchSelectedField({ options: field.options.map(o => o.id === optionId ? { ...o, [key]: (event.target as HTMLInputElement).value } : o) });
    }
  }
  protected addOption(): void {
    const field = this.selectedField();
    if (field?.type === 'single-choice' || field?.type === 'multi-choice') {
      const option: SurveyOption = { id: newId('option'), label: `Opcja ${field.options.length + 1}` };
      this.patchSelectedField({ options: [...field.options, option] });
    }
  }
  protected removeOption(optionId: string): void {
    const field = this.selectedField();
    if ((field?.type === 'single-choice' || field?.type === 'multi-choice') && field.options.length > 1) {
      this.patchSelectedField({ options: field.options.filter(o => o.id !== optionId) });
    }
  }

  protected dropField(event: CdkDragDrop<SurveyField[]>, toSectionId: string): void {
    this.dragging.set(false);
    const fromSectionId = event.previousContainer.id.replace(/^survey-fields-/, '');
    const to = this.survey().sections.find(s => s.id === toSectionId);
    const from = this.survey().sections.find(s => s.id === fromSectionId);
    if (!to || !from) return;
    const fieldId = from.fields[event.previousIndex]?.id;
    if (!fieldId) return;
    const next = moveFieldByIndex(this.survey(), fromSectionId, event.previousIndex, toSectionId, event.currentIndex);
    if (next !== this.survey()) this.save(next);
    if (this.selected()?.fieldId === fieldId && fromSectionId !== toSectionId) {
      this.selected.set({ sectionId: toSectionId, fieldId });
    }
  }

  protected exportJson(): void {
    const blob = new Blob([JSON.stringify(this.survey(), null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ursunalia-ankieta-${this.survey().id.replace(/[^a-zA-Z0-9_-]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    this.showNotice('Wyeksportowano definicję ankiety.');
  }
  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 400_000) { this.importError.set('Plik jest zbyt duży.'); input.value = ''; return; }
    try { this.importText.set(await file.text()); this.importError.set(''); this.importOpen.set(true); }
    catch { this.importError.set('Nie udało się odczytać pliku.'); }
    input.value = '';
  }
  protected applyImport(): void {
    try {
      const imported = parseImportedSurvey(this.importText());
      if (!confirm('Zastąpić obecny szkic zaimportowaną ankietą? Najpierw wyeksportuj kopię, jeśli jest potrzebna.')) return;
      this.save(imported);
      this.selected.set(null);
      this.mode.set('edit');
      this.importOpen.set(false);
      this.importText.set('');
      this.importError.set('');
      this.showNotice('Zaimportowano poprawną ankietę.');
    } catch (error) {
      this.importError.set(error instanceof Error ? error.message : 'Błąd importu.');
    }
  }
  protected resetToDemo(): void {
    if (!confirm('Zastąpić bieżący szkic przykładową ankietą?')) return;
    this.save(structuredClone(DEMO_SURVEY));
    this.selected.set(null);
    this.mode.set('edit');
  }
}
