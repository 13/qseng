import { PartialDate } from '../../core/api/generated';

const MAX_YEAR = 2099;

function daysIn(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Accepts "YYYY", "MM.YYYY", "DD.MM.YYYY", each optionally prefixed with "~".
 * Empty → null. Anything else → undefined (invalid).
 */
export function parsePartialDate(text: string): PartialDate | null | undefined {
  const raw = text.trim();
  if (!raw) return null;
  const approx = raw.startsWith('~');
  const parts = (approx ? raw.slice(1) : raw).trim().split('.').map(p => p.trim());
  const nums = parts.map(p => (/^\d+$/.test(p) ? Number(p) : NaN));
  if (nums.some(Number.isNaN)) return undefined;
  const withApprox = (d: PartialDate): PartialDate => (approx ? { ...d, approx: true } : d);

  if (nums.length === 1) {
    const [year] = nums;
    return year >= 1 && year <= MAX_YEAR ? withApprox({ year }) : undefined;
  }
  if (nums.length === 2) {
    const [month, year] = nums;
    return month >= 1 && month <= 12 && year >= 1 && year <= MAX_YEAR ? withApprox({ year, month }) : undefined;
  }
  if (nums.length === 3) {
    const [day, month, year] = nums;
    const ok = month >= 1 && month <= 12 && year >= 1 && year <= MAX_YEAR && day >= 1 && day <= daysIn(year, month);
    return ok ? withApprox({ year, month, day }) : undefined;
  }
  return undefined;
}

export function isEmptyPartialDate(d: PartialDate | null | undefined): boolean {
  return d == null || d.year == null;
}

/** "~02.06.1923", "06.1923", "1923" or "" when the year is unknown. */
export function formatPartialDate(d: PartialDate | null | undefined): string {
  if (isEmptyPartialDate(d)) return '';
  const { year, month, day, approx } = d as PartialDate;
  const p = approx ? '~' : '';
  const mm = month != null ? String(month).padStart(2, '0') : null;
  const dd = day != null ? String(day).padStart(2, '0') : null;
  if (mm && dd) return `${p}${dd}.${mm}.${year}`;
  if (mm) return `${p}${mm}.${year}`;
  return `${p}${year}`;
}
