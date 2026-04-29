import { Injectable } from '@angular/core';
import { ApiClient, TimelineEvent } from '../../core/api/api-client.service';

@Injectable({ providedIn: 'root' })
export class TimelineService {
  constructor(private api: ApiClient) {}

  list(personId: string) { return this.api.getTimeline(personId); }
  add(personId: string, ev: Partial<TimelineEvent>) { return this.api.addTimelineEvent(personId, ev); }
  update(personId: string, id: string, ev: Partial<TimelineEvent>) { return this.api.updateTimelineEvent(personId, id, ev); }
  remove(personId: string, id: string) { return this.api.deleteTimelineEvent(personId, id); }
}
