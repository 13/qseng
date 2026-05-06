import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges, inject, ElementRef, HostListener
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';

export interface PartialDateValue {
  year?: number;
  month?: number;
  day?: number;
  approx?: boolean;
}

const MONTHS = [
  { n: 1,  label: 'Jan' }, { n: 2,  label: 'Feb' }, { n: 3,  label: 'Mar' },
  { n: 4,  label: 'Apr' }, { n: 5,  label: 'May' }, { n: 6,  label: 'Jun' },
  { n: 7,  label: 'Jul' }, { n: 8,  label: 'Aug' }, { n: 9,  label: 'Sep' },
  { n: 10, label: 'Oct' }, { n: 11, label: 'Nov' }, { n: 12, label: 'Dec' },
];

@Component({
  selector: 'qs-partial-date-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="dp">
      <!-- Text input + calendar button -->
      <div class="dp-row">
        <input type="text" class="dp-text"
               [value]="textValue"
               (input)="onInput($event)"
               (blur)="onCommit()"
               (keydown.enter)="onCommit()"
               [placeholder]="i18n.t('date.hint')"
               autocomplete="off" spellcheck="false">
        <button type="button" class="dp-btn"
                [class.dp-btn--open]="open"
                [title]="i18n.t('date.pick')"
                (click)="open = !open">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2.5" width="12" height="10.5" rx="1.5"
                  stroke="currentColor" stroke-width="1.3"/>
            <line x1="1" y1="6.5" x2="13" y2="6.5"
                  stroke="currentColor" stroke-width="1.3"/>
            <line x1="4" y1="1" x2="4" y2="4.5"
                  stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <line x1="10" y1="1" x2="10" y2="4.5"
                  stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Picker panel (opened by the calendar button) -->
      @if (open) {
        <div class="dp-panel" role="dialog">

          <!-- Year navigation -->
          <div class="dp-year-row">
            <button type="button" class="dp-nav" (click)="adjYear(-1)" tabindex="-1">◀</button>
            <input type="number" class="dp-year-inp"
                   [value]="_year ?? ''"
                   (change)="setYear($any($event.target).value)"
                   (blur)="setYear($any($event.target).value)"
                   (keydown.enter)="setYear($any($event.target).value)"
                   placeholder="YYYY" min="1" max="2099">
            <button type="button" class="dp-nav" (click)="adjYear(+1)" tabindex="-1">▶</button>
          </div>

          <!-- Month grid (4 per row) -->
          <div class="dp-month-grid">
            @for (m of MONTHS; track m.n) {
              <button type="button" class="dp-cell"
                      [class.sel]="_month === m.n"
                      [class.dim]="!_year"
                      (click)="pickMonth(m.n)">{{ m.label }}</button>
            }
          </div>

          <!-- Day grid — only when a month is selected -->
          @if (_month) {
            <div class="dp-sep"></div>
            <div class="dp-day-grid">
              @for (d of days; track d) {
                <button type="button" class="dp-cell dp-day"
                        [class.sel]="_day === d"
                        (click)="pickDay(d)">{{ d }}</button>
              }
            </div>
          }

          <!-- Footer: approx toggle + clear -->
          <div class="dp-footer">
            <label class="dp-approx">
              <input type="checkbox" [(ngModel)]="_approx" (ngModelChange)="syncAndEmit()">
              <span>~ {{ i18n.t('pe.approx') }}</span>
            </label>
            <button type="button" class="dp-clear" (click)="clear()">
              {{ i18n.t('date.clear') }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .dp { position: relative; display: block; }

    /* ── Input row ── */
    .dp-row { display: flex; align-items: stretch; }

    .dp-text {
      flex: 1; padding: .35rem .55rem;
      background: var(--c-surface); border: 1px solid var(--c-border);
      border-right: none; border-radius: var(--r-sm, 6px) 0 0 var(--r-sm, 6px);
      font-size: .875rem; color: var(--c-text); min-width: 0;
      &:focus { outline: none; border-color: var(--c-accent);
                + .dp-btn { border-color: var(--c-accent); } }
      &::placeholder { color: var(--c-text-3); }
    }

    .dp-btn {
      display: flex; align-items: center; justify-content: center;
      padding: .35rem .55rem; flex-shrink: 0;
      background: var(--c-surface); border: 1px solid var(--c-border);
      border-radius: 0 var(--r-sm, 6px) var(--r-sm, 6px) 0;
      cursor: pointer; color: var(--c-text-3);
      transition: background 120ms, color 120ms, border-color 120ms;
      &:hover { background: var(--c-accent-sub); color: var(--c-accent); border-color: var(--c-accent); }
      &.dp-btn--open { background: var(--c-accent-sub); color: var(--c-accent); border-color: var(--c-accent); }
    }

    /* ── Picker panel ── */
    .dp-panel {
      position: absolute; top: calc(100% + 4px); left: 0; z-index: 200;
      background: var(--c-bg); border: 1px solid var(--c-border);
      border-radius: var(--r-md, 8px); box-shadow: 0 8px 24px rgba(0,0,0,.13);
      padding: .65rem; width: 268px;
    }

    /* ── Year row ── */
    .dp-year-row { display: flex; align-items: center; gap: .35rem; margin-bottom: .55rem; }

    .dp-nav {
      flex-shrink: 0; width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      border: 1px solid var(--c-border); border-radius: 4px;
      background: var(--c-surface); cursor: pointer;
      font-size: .6rem; color: var(--c-text-2);
      &:hover { background: var(--c-accent-sub); color: var(--c-accent); }
    }

    .dp-year-inp {
      flex: 1; text-align: center; padding: .2rem; height: 28px;
      border: 1px solid var(--c-border); border-radius: 4px;
      background: var(--c-surface); color: var(--c-text);
      font-size: .9rem; font-weight: 700;
      -moz-appearance: textfield;
      &::-webkit-outer-spin-button, &::-webkit-inner-spin-button { -webkit-appearance: none; }
      &:focus { outline: none; border-color: var(--c-accent); }
    }

    /* ── Grids ── */
    .dp-month-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; }
    .dp-day-grid   { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .dp-sep        { height: 1px; background: var(--c-border); margin: .45rem 0; }

    .dp-cell {
      padding: .3rem .1rem; border: none; border-radius: 4px;
      background: transparent; cursor: pointer;
      font-size: .78rem; color: var(--c-text); text-align: center;
      transition: background 100ms;
      &:hover:not(.dim) { background: var(--c-accent-sub); }
      &.sel { background: var(--c-accent); color: #fff; font-weight: 600; }
      &.dim { opacity: .28; cursor: default; pointer-events: none; }
    }
    .dp-day { font-size: .71rem; padding: .22rem .05rem; }

    /* ── Footer ── */
    .dp-footer {
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid var(--c-border); padding-top: .45rem; margin-top: .45rem;
    }
    .dp-approx {
      display: flex; align-items: center; gap: .3rem;
      font-size: .76rem; color: var(--c-text-2); cursor: pointer;
      input[type=checkbox] { margin: 0; }
    }
    .dp-clear {
      font-size: .73rem; padding: .18rem .5rem;
      border: 1px solid var(--c-border); border-radius: 4px;
      background: transparent; color: var(--c-text-3); cursor: pointer;
      &:hover { color: var(--c-text); border-color: var(--c-text-3); }
    }
  `]
})
export class PartialDateInputComponent implements OnChanges {
  /** Kept for backward-compatibility; unused in the UI. */
  @Input() prefix = 'date';
  @Input() value: PartialDateValue | null = null;
  @Output() valueChange = new EventEmitter<PartialDateValue>();

  readonly i18n = inject(I18nService);
  private elRef  = inject(ElementRef);

  readonly MONTHS = MONTHS;
  open = false;

  _year?: number;
  _month?: number;
  _day?: number;
  _approx = false;

  /** Canonical formatted string, e.g. "~12.06.1923" or "1923". */
  get displayValue(): string {
    const { _year: y, _month: m, _day: d, _approx: a } = this;
    if (!y) return '';
    const p = a ? '~' : '';
    if (d && m) return `${p}${String(d).padStart(2,'0')}.${String(m).padStart(2,'0')}.${y}`;
    if (m)      return `${p}${String(m).padStart(2,'0')}.${y}`;
    return `${p}${y}`;
  }

  /** What the text field shows (raw while editing, canonical after commit). */
  textValue = '';

  /** Days in the selected month, accounting for leap years. */
  get days(): number[] {
    const m = this._month;
    if (!m) return Array.from({ length: 31 }, (_, i) => i + 1);
    return Array.from({ length: new Date(this._year ?? 2000, m, 0).getDate() }, (_, i) => i + 1);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value']) {
      const v = this.value;
      this._year   = v?.year;
      this._month  = v?.month;
      this._day    = v?.day;
      this._approx = v?.approx ?? false;
      this.textValue = this.displayValue;
    }
  }

  @HostListener('document:mousedown', ['$event'])
  onDocMousedown(e: MouseEvent) {
    if (this.open && !(this.elRef.nativeElement as HTMLElement).contains(e.target as Node)) {
      this.open = false;
    }
  }

  // ── Text field ──────────────────────────────────────────────────────────────

  onInput(e: Event) {
    this.textValue = (e.target as HTMLInputElement).value;
  }

  /** Parse the text on blur / Enter and commit to the picker state. */
  onCommit() {
    const parsed = this.parse(this.textValue);
    this._year   = parsed.year;
    this._month  = parsed.month;
    this._day    = parsed.day;
    this._approx = parsed.approx ?? false;
    this.textValue = this.displayValue;
    this.emit();
  }

  // ── Picker actions ──────────────────────────────────────────────────────────

  adjYear(delta: number) {
    this._year = (this._year ?? new Date().getFullYear()) + delta;
    this.syncAndEmit();
  }

  setYear(raw: string | number) {
    const n = Number(raw);
    this._year = raw !== '' && n >= 1 ? Math.min(Math.round(n), 2099) : undefined;
    if (!this._year) { this._month = undefined; this._day = undefined; }
    this.syncAndEmit();
  }

  pickMonth(m: number) {
    if (!this._year) return;
    this._month = this._month === m ? undefined : m;
    if (!this._month) this._day = undefined;
    if (this._day && this._day > this.days.length) this._day = undefined;
    this.syncAndEmit();
  }

  pickDay(d: number) {
    this._day = this._day === d ? undefined : d;
    this.syncAndEmit();
  }

  clear() {
    this._year = undefined; this._month = undefined;
    this._day = undefined; this._approx = false;
    this.syncAndEmit();
  }

  /** Sync text field from picker state, then emit. */
  syncAndEmit() {
    this.textValue = this.displayValue;
    this.emit();
  }

  emit() {
    this.valueChange.emit({
      year:   this._year,
      month:  this._month,
      day:    this._day,
      approx: this._approx || undefined,
    });
  }

  // ── Parsing ─────────────────────────────────────────────────────────────────

  /**
   * Accepts "YYYY", "MM.YYYY", "DD.MM.YYYY" — each optionally prefixed with "~".
   * Returns an empty object for anything that doesn't match.
   */
  private parse(s: string): PartialDateValue {
    const raw = s.trim();
    if (!raw) return {};
    const approx = raw.startsWith('~');
    const clean  = approx ? raw.slice(1).trim() : raw;
    const parts  = clean.split('.').map(p => p.trim()).filter(Boolean);

    if (parts.length === 1) {
      const y = parseInt(parts[0], 10);
      if (!isNaN(y) && y >= 1 && y <= 2099) return { year: y, approx: approx || undefined };
    } else if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const y = parseInt(parts[1], 10);
      if (m >= 1 && m <= 12 && y >= 1 && y <= 2099) return { year: y, month: m, approx: approx || undefined };
    } else if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1 && y <= 2099) {
        return { year: y, month: m, day: d, approx: approx || undefined };
      }
    }
    return {};
  }
}
