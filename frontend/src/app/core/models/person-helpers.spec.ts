import { describe, expect, it } from 'vitest';
import { fullName, initials, lifespan, sexClass } from './person-helpers';

describe('person helpers', () => {
  const p = { firstName: 'Konrad', lastName: 'Smith', birth: { year: 1843 }, death: { year: 1909 }, sex: 'Male' as const };
  it('fullName / initials', () => {
    expect(fullName(p)).toBe('Konrad Smith');
    expect(initials(p)).toBe('KS');
    expect(initials({ firstName: '', lastName: 'x' })).toBe('X');
  });
  it('lifespan variants', () => {
    expect(lifespan(p)).toBe('1843 – 1909');
    expect(lifespan({ ...p, death: null })).toBe('* 1843');
    expect(lifespan({ ...p, birth: undefined })).toBe('† 1909');
    expect(lifespan({ firstName: 'a', lastName: 'b' })).toBe('');
  });
  it('sexClass', () => {
    expect(sexClass('Female')).toBe('female');
    expect(sexClass(undefined)).toBe('unknown');
  });
});
