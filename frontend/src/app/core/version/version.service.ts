import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { SKIP_ERROR_TOAST } from '../error.interceptor';

export interface BuildInfo { version: string; commit: string; }

interface BuildInfoLike { version?: string | null; commit?: string | null; }

function toInfo(v: BuildInfoLike | null): BuildInfo | null {
  return v?.version ? { version: v.version, commit: v.commit || 'unknown' } : null;
}

/** Build identity of the web bundle (/version.json) and the API (/health/ready), fetched once. */
@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly http = inject(HttpClient);
  private loaded = false;
  readonly web = signal<BuildInfo | null>(null);
  readonly api = signal<BuildInfo | null>(null);

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    const context = new HttpContext().set(SKIP_ERROR_TOAST, true);
    this.http.get<BuildInfoLike>('/version.json', { context }).pipe(catchError(() => of(null)))
      .subscribe(v => this.web.set(toInfo(v)));
    this.http.get<BuildInfoLike>('/health/ready', { context }).pipe(catchError(() => of(null)))
      .subscribe(v => this.api.set(toInfo(v)));
  }
}
