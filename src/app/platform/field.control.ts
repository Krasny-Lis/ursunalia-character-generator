import { Component, HostListener, input, output, signal } from '@angular/core';
import { CdkConnectedOverlay, CdkOverlayOrigin, type ConnectedPosition } from '@angular/cdk/overlay';
import { FormsModule } from '@angular/forms';
import { Answer, Field } from './models';
import { Icon } from './icon';
@Component({
  selector: 'u-field',
  standalone: true,
  imports: [FormsModule, Icon, CdkConnectedOverlay, CdkOverlayOrigin],
  template: ` <div class="field" [class.invalid]="error()" [attr.id]="'field-' + field().id">
    @if (field().type !== 'info') {
      <label
        class="field-label"
        [attr.for]="'input-' + field().id"
        [attr.id]="'label-' + field().id"
        >{{ field().label }}
        @if (field().required) {
          <span class="required" aria-label="wymagane">*</span>
        }
      </label>
    }
    @switch (field().type) {
      @case ('text') {
        <input
          [id]="'input-' + field().id"
          [ngModel]="value() || ''"
          (ngModelChange)="changed.emit($event)"
          [placeholder]="field().placeholder || ''"
          [maxlength]="field().maxLength ?? 10000"
          [disabled]="disabled()"
          [attr.aria-required]="field().required"
          [attr.aria-invalid]="!!error()"
          [attr.aria-describedby]="'help-' + field().id + (error() ? ' error-' + field().id : '')"
        />
      }
      @case ('date') {
        <input
          type="date"
          [id]="'input-' + field().id"
          [ngModel]="value() || ''"
          (ngModelChange)="changed.emit($event)"
          [disabled]="disabled()"
          [attr.aria-required]="field().required"
          [attr.aria-invalid]="!!error()"
        />
      }
      @case ('textarea') {
        <textarea
          [id]="'input-' + field().id"
          rows="4"
          [ngModel]="value() || ''"
          (ngModelChange)="changed.emit($event)"
          [placeholder]="field().placeholder || 'Wpisz swoją odpowiedź…'"
          [maxlength]="field().maxLength ?? 10000"
          [disabled]="disabled()"
          [attr.aria-required]="field().required"
          [attr.aria-invalid]="!!error()"
          [attr.aria-describedby]="'help-' + field().id + (error() ? ' error-' + field().id : '')"
        ></textarea
        ><small class="counter">{{ textLength() }} / {{ field().maxLength ?? 10000 }}</small>
      }
      @case ('select') {
        <div class="described-select" [class.open]="dropdownOpen()"
          cdkOverlayOrigin #dropdownOrigin="cdkOverlayOrigin">
          <button type="button" class="described-select-trigger"
            [id]="'input-' + field().id"
            [disabled]="disabled()"
            [attr.aria-expanded]="dropdownOpen()"
            [attr.aria-controls]="'select-options-' + field().id"
            [attr.aria-required]="field().required"
            [attr.aria-invalid]="!!error()"
            (click)="dropdownOpen.set(!dropdownOpen())">
            {{ selectedOption()?.label || 'Wybierz…' }} <u-icon name="chevron" />
          </button>
        </div>
        <ng-template cdkConnectedOverlay
          [cdkConnectedOverlayOrigin]="dropdownOrigin"
          [cdkConnectedOverlayOpen]="dropdownOpen()"
          [cdkConnectedOverlayPositions]="dropdownPositions"
          [cdkConnectedOverlayWidth]="dropdownOrigin.elementRef.nativeElement.offsetWidth"
          [cdkConnectedOverlayHasBackdrop]="true"
          cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
          [cdkConnectedOverlayPush]="true"
          [cdkConnectedOverlayViewportMargin]="8"
          (backdropClick)="dropdownOpen.set(false)">
          <div class="described-select-options"
            [id]="'select-options-' + field().id"
            role="group" [attr.aria-label]="'Wybierz: ' + field().label">
            <button type="button" class="described-select-option"
              (click)="chooseOption('')">Wybierz…</button>
            @for (option of field().options; track option.id) {
              <button type="button" class="described-select-option"
                [class.selected]="value() === option.id"
                [attr.aria-pressed]="value() === option.id"
                (click)="chooseOption(option.id)">
                <strong>{{ option.label }}</strong>
                @if (option.description) { <small>{{ option.description }}</small> }
              </button>
            }
          </div>
        </ng-template>
        @if (selectedDescription()) {
          <div class="choice-help selected-description">{{ selectedDescription() }}</div>
        }
      }
      @case ('single') {
        @if (hasDescriptions()) {
          <button type="button" class="descriptions-toggle" [attr.aria-pressed]="expandedDescriptions()"
            (click)="expandedDescriptions.set(!expandedDescriptions())">
            {{ expandedDescriptions() ? 'Zwiń opisy' : 'Pokaż pełne opisy odpowiedzi' }}
          </button>
        }
        <div class="choices" role="radiogroup" [attr.aria-labelledby]="'label-' + field().id" [attr.aria-required]="field().required">
          @for (option of field().options; track option.id) {
            <label class="choice" [class.selected]="value() === option.id"
              [class.choice-with-description]="!!option.description"
              [class.show-description]="expandedDescriptions()"
              [attr.data-tooltip]="expandedDescriptions() ? null : (option.description || null)">
              <input type="radio" [name]="field().id" [value]="option.id"
                [checked]="value() === option.id" (change)="changed.emit(option.id)" [disabled]="disabled()" />
              <span>{{ option.label }}</span>
              @if (expandedDescriptions() && option.description) {
                <small class="option-full-description">{{ option.description }}</small>
              }
            </label>
          }
        </div>
      }
      @case ('multi') {
        @if (hasDescriptions()) {
          <button type="button" class="descriptions-toggle" [attr.aria-pressed]="expandedDescriptions()"
            (click)="expandedDescriptions.set(!expandedDescriptions())">
            {{ expandedDescriptions() ? 'Zwiń opisy' : 'Pokaż pełne opisy odpowiedzi' }}
          </button>
        }
        <div class="choices" role="group" [attr.aria-labelledby]="'label-' + field().id">
          @for (option of visibleOptions(); track option.id) {
            <label class="choice" [class.selected]="isSelected(option.id)"
              [class.choice-with-description]="!!option.description"
              [class.show-description]="expandedDescriptions()"
              [attr.data-tooltip]="expandedDescriptions() ? null : (option.description || null)">
              <input type="checkbox" [checked]="isSelected(option.id)" (change)="toggle(option.id)" [disabled]="disabled()" />
              <span>{{ option.label }}</span>
              @if (expandedDescriptions() && option.description) {
                <small class="option-full-description">{{ option.description }}</small>
              }
            </label>
          }
        </div>
        @if ((field().options?.length ?? 0) > 9) {
          <button type="button" class="text-button" (click)="expanded.set(!expanded())">
            {{ expanded() ? 'Pokaż mniej' : 'Pokaż wszystkie (' + field().options!.length + ')' }}
            <u-icon name="chevron" />
          </button>
        }
      }
      @case ('rating') {
        <div class="rating" role="radiogroup" [attr.aria-labelledby]="'label-' + field().id">
          @for (n of range(); track n) {
            <label [class.selected]="value() === n"
              ><input
                type="radio"
                [name]="field().id"
                [value]="n"
                [checked]="value() === n"
                (change)="changed.emit(n)"
                [disabled]="disabled()"
              /><span>{{ n }}</span></label
            >
          }
        </div>
      }
      @case ('file') {
        <div class="upload-control">
          @if (value()) {
            <img [src]="value()" alt="Portret postaci" /><button
              type="button"
              class="text-button"
              [disabled]="disabled()"
              (click)="changed.emit('')"
            >
              Usuń portret
            </button>
          }
          <input
            type="file"
            [id]="'input-' + field().id"
            accept="image/png,image/jpeg,image/webp"
            (change)="upload($event)"
            [disabled]="disabled()"
          /><small role="alert">{{ fileError() }}</small>
        </div>
      }
      @case ('info') {
        <div class="info-box">
          <u-icon name="info" />
          <div>
            <strong>{{ field().label }}</strong>
            <p>{{ field().description }}</p>
          </div>
        </div>
      }
    }
    @if (field().type !== 'info') {
      <small class="help" [id]="'help-' + field().id">{{ field().description }}</small>
    }
    @if (error()) {
      <small class="field-error" [id]="'error-' + field().id" role="alert">{{ error() }}</small>
    }
  </div>`,
})
export class FieldControl {
  field = input.required<Field>();
  value = input<Answer>();
  error = input('');
  disabled = input(false);
  changed = output<Answer>();
  expanded = signal(false);
  expandedDescriptions = signal(false);
  dropdownOpen = signal(false);
  fileError = signal('');
  readonly dropdownPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];
  @HostListener('document:keydown.escape')
  onEscape() { this.dropdownOpen.set(false); }
  hasDescriptions() {
    return this.field().options?.some((option) => !!option.description) ?? false;
  }
  selectedOption() {
    return this.field().options?.find((option) => option.id === this.value());
  }
  chooseOption(id: string) {
    this.changed.emit(id);
    this.dropdownOpen.set(false);
  }
  textLength() {
    return typeof this.value() === 'string' ? (this.value() as string).length : 0;
  }
  isSelected(id: string) {
    return Array.isArray(this.value()) && (this.value() as string[]).includes(id);
  }
  toggle(id: string) {
    const current = Array.isArray(this.value()) ? (this.value() as string[]) : [];
    this.changed.emit(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }
  range() {
    return Array.from(
      { length: Math.min(11, (this.field().max ?? 5) - (this.field().min ?? 1) + 1) },
      (_, i) => i + (this.field().min ?? 1),
    );
  }
  visibleOptions() {
    const options = this.field().options ?? [];
    return this.expanded() ? options : options.filter((o, i) => i < 9 || this.isSelected(o.id));
  }
  selectedDescription() {
    return this.field().options?.find((o) => o.id === this.value())?.description;
  }
  async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 750 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.fileError.set('Wybierz JPG, PNG lub WebP do 750 KB.');
      input.value = '';
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = () => {
        this.changed.emit(String(reader.result));
        this.fileError.set('');
      };
      reader.onerror = () => this.fileError.set('Nie udało się odczytać obrazu.');
      reader.readAsDataURL(file);
    } catch {
      this.fileError.set('Nie udało się odczytać obrazu.');
    }
  }
}
