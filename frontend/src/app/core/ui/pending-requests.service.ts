import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PendingRequestsService {
  private readonly _count = signal(0);
  readonly count = this._count.asReadonly();
  readonly busy = computed(() => this._count() > 0);

  start() { this._count.update(n => n + 1); }
  end()   { this._count.update(n => Math.max(0, n - 1)); }
}
