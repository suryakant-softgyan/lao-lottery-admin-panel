import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { TimelineEvent } from '@core/models/common.model';
import { Avatar } from '../avatar/avatar';
import { RelativePipe } from '../../pipes/format.pipes';
import { StatePanel } from '../state-panel/state-panel';

/**
 * "Who changed what and when" trail shown on every detail page.
 *
 * A consistent audit narrative next to the record itself is one of the fastest
 * ways to resolve a support query, so it is a first-class shared component
 * rather than something each module reinvents.
 */
@Component({
  selector: 'll-activity-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, RelativePipe, StatePanel],
  template: `
    @if (events().length === 0) {
      <ll-state-panel
        kind="empty"
        [compact]="true"
        title="No activity yet"
        message="Changes to this record will be listed here." />
    } @else {
      <ol class="timeline" role="list">
        @for (event of events(); track event.id) {
          <li class="timeline__item">
            <div class="timeline__marker" [style.--tone]="'var(--ll-' + event.tone + ')'">
              <span class="material-symbols-rounded" aria-hidden="true">{{ event.icon }}</span>
            </div>

            <div class="timeline__body">
              <div class="timeline__head">
                <span class="timeline__title">{{ event.title }}</span>
                <time class="timeline__time" [attr.datetime]="event.timestamp">
                  {{ event.timestamp | llRelative }}
                </time>
              </div>

              @if (event.description) {
                <p class="timeline__description">{{ event.description }}</p>
              }

              @if (event.meta) {
                <dl class="timeline__meta">
                  @for (entry of metaEntries(event); track entry[0]) {
                    <div>
                      <dt>{{ entry[0] }}</dt>
                      <dd>{{ entry[1] }}</dd>
                    </div>
                  }
                </dl>
              }

              <div class="timeline__actor">
                <ll-avatar [name]="event.actor" [src]="event.actorAvatar ?? null" [size]="20" />
                <span>{{ event.actor }}</span>
              </div>
            </div>
          </li>
        }
      </ol>
    }
  `,
  styleUrl: './activity-timeline.scss',
})
export class ActivityTimeline {
  readonly events = input<TimelineEvent[]>([]);

  protected metaEntries(event: TimelineEvent): [string, string][] {
    return Object.entries(event.meta ?? {});
  }
}
