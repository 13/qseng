import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';
import { VersionService } from './version.service';
import { SKIP_ERROR_TOAST } from '../error.interceptor';

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()]
  });
  return { service: TestBed.inject(VersionService), ctrl: TestBed.inject(HttpTestingController) };
}

describe('VersionService', () => {
  it('requests /version.json and /health/ready once each, and a second load() issues no new requests', () => {
    const { service, ctrl } = setup();
    service.load();
    const versionReq = ctrl.expectOne('/version.json');
    const healthReq = ctrl.expectOne('/health/ready');

    service.load();
    ctrl.verify();

    versionReq.flush({ version: '1.2.0', commit: 'abc1234def' });
    healthReq.flush({ status: 'Healthy', version: '1.2.0', commit: 'abc1234def' });

    expect(service.web()).toEqual({ version: '1.2.0', commit: 'abc1234def' });
    expect(service.api()).toEqual({ version: '1.2.0', commit: 'abc1234def' });
  });

  it('leaves api() at null without throwing when /health/ready returns 503', () => {
    const { service, ctrl } = setup();
    service.load();
    ctrl.expectOne('/version.json').flush({ version: '1.2.0', commit: 'abc1234def' });
    ctrl.expectOne('/health/ready').flush({ title: 'Service unavailable' }, { status: 503, statusText: 'u' });

    expect(service.api()).toBeNull();
  });

  it('both requests carry SKIP_ERROR_TOAST', () => {
    const { service, ctrl } = setup();
    service.load();
    const versionReq = ctrl.expectOne('/version.json');
    const healthReq = ctrl.expectOne('/health/ready');

    expect(versionReq.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    expect(healthReq.request.context.get(SKIP_ERROR_TOAST)).toBe(true);

    versionReq.flush({ version: '1.2.0', commit: 'abc1234def' });
    healthReq.flush({ status: 'Healthy', version: '1.2.0', commit: 'abc1234def' });
  });
});
