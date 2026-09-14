import { PartialDate, Sex } from '../api/generated';

export interface PersonLike {
  firstName: string;
  lastName: string;
  maidenName?: string | null;
  birth?: PartialDate | null;
  death?: PartialDate | null;
  sex?: Sex | null;
}

export function fullName(p: PersonLike): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

export function initials(p: PersonLike): string {
  return ((p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')).toUpperCase();
}

/** "1843 – 1909", "* 1843", "† 1909" or "" when nothing is known. */
export function lifespan(p: PersonLike): string {
  const b = p.birth?.year, d = p.death?.year;
  if (b && d) return `${b} – ${d}`;
  if (b) return `* ${b}`;
  if (d) return `† ${d}`;
  return '';
}

export function sexClass(sex: Sex | null | undefined): 'male' | 'female' | 'unknown' {
  return sex === 'Male' ? 'male' : sex === 'Female' ? 'female' : 'unknown';
}
