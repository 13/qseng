import { FormGroup } from '@angular/forms';
import { ValidationProblemDetails } from '../api/problem-details';

/**
 * Applies `errors: { "birth.year": ["..."] }` onto matching controls as
 * `{ server: string }`. Returns messages for fields the form doesn't have.
 */
export function setServerErrors(form: FormGroup, problem: ValidationProblemDetails): string[] {
  const unmatched: string[] = [];
  for (const [path, messages] of Object.entries(problem.errors)) {
    const control = form.get(path.split('.'));
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), server: messages.join(' ') });
      control.markAsTouched();
    } else {
      unmatched.push(...messages);
    }
  }
  return unmatched;
}
