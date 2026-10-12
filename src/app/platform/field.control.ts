import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Answer, Field } from './models';
import { Icon } from './icon';
@Component({
  selector: 'u-field',
  standalone: true,
  imports: [FormsModule, Icon],
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
        <select
          [id]="'input-' + field().id"
          [ngModel]="value() || ''"
          (ngModelChange)="changed.emit($event)"
          [disabled]="disabled()"
          [attr.aria-required]="field().required"
          [attr.aria-invalid]="!!error()"
        >
          <option value="">Wybierz…</option>
          @for (option of field().options; track option.id) {
            <option [value]="option.id">{{ option.label }}</option>
          }
        </select>
        @if (selectedDescription()) {
          <details class="choice-help">
            <summary>O wybranej odpowiedzi</summary>
            <p>{{ selectedDescription() }}</p>
          </details>
        }
      }
      @case ('single') {
        <div
          class="choices"
          role="radiogroup"
          [attr.aria-labelledby]="'label-' + field().id"
          [attr.aria-required]="field().required"
        >
          @for (option of field().options; track option.id) {
            <label class="choice" [class.selected]="value() === option.id"
              ><input
                type="radio"
                [name]="field().id"
                [value]="option.id"
                [checked]="value() === option.id"
                (change)="changed.emit(option.id)"
                [disabled]="disabled()"
              /><span>{{ option.label }}</span></label
            >
          }
        </div>
      }
      @case ('multi') {
        <div class="choices" role="group" [attr.aria-labelledby]="'label-' + field().id">
          @for (option of visibleOptions(); track option.id) {
            <label
              class="choice"
              [class.selected]="isSelected(option.id)"
              [title]="option.description || ''"
              ><input
                type="checkbox"
                [checked]="isSelected(option.id)"
                (change)="toggle(option.id)"
                [disabled]="disabled()"
              /><span>{{ option.label }}</span></label
            >
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
  fileError = signal('');
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
