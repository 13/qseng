import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { isValidationProblem, problemMessage } from './problem-details';

describe('problem-details', () => {
  it('prefers detail, then title, then fallback', () => {
    expect(problemMessage(new HttpErrorResponse({ error: { status: 409, title: 'Conflict', detail: 'Name taken' } }), 'x')).toBe('Name taken');
    expect(problemMessage(new HttpErrorResponse({ error: { status: 404, title: 'Not Found' } }), 'x')).toBe('Not Found');
    expect(problemMessage(new HttpErrorResponse({ error: 'html garbage' }), 'fallback')).toBe('fallback');
  });

  it('surfaces the first validation message', () => {
    const err = new HttpErrorResponse({ error: { status: 400, title: 'v', errors: { firstName: ['Required.'] } } });
    expect(isValidationProblem(err.error)).toBe(true);
    expect(problemMessage(err, 'x')).toBe('Required.');
  });
});
