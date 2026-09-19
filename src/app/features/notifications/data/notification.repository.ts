import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CampaignStatus } from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type {
  AudienceSegment,
  NotificationCampaign,
  NotificationMessage,
  NotificationTemplate,
  Page,
  PageQuery,
  StatMetric,
} from '@core/models';
import { BaseRepository } from '@core/services/base-repository';
import { NotificationCentreService } from '@core/services/notification-centre.service';
import { applyQuery } from '@core/utilities/query.util';
import { sumBy } from '@core/utilities/object.util';

/** Templates, segments, campaigns and the in-app notification inbox. */
@Injectable({ providedIn: 'root' })
export class NotificationRepository extends BaseRepository<NotificationTemplate> {
  protected readonly resourcePath = 'notification-templates';

  protected override queryOptions = {
    searchFields: ['name', 'code', 'subject', 'body', 'channel', 'category'],
    dateField: 'createdAt',
  };

  private readonly centre = inject(NotificationCentreService);

  protected seed(): NotificationTemplate[] {
    return mockDataset.notificationTemplates;
  }

  setTemplateActive(id: string, active: boolean): Observable<NotificationTemplate> {
    return this.patch(id, { active } as Partial<NotificationTemplate>);
  }

  // ---------------------------------------------------------------- inbox

  inbox(query: PageQuery): Observable<Page<NotificationMessage>> {
    return this.centre.list(query);
  }

  markRead(id: string): void {
    this.centre.markRead(id);
  }

  markAllRead(): void {
    this.centre.markAllRead();
  }

  remove(id: string): void {
    this.centre.remove(id);
  }

  // --------------------------------------------------------------- segments

  segments(query: PageQuery): Observable<Page<AudienceSegment>> {
    return this.backend.respond(() =>
      applyQuery(mockDataset.segments, query, {
        searchFields: ['name', 'code', 'description', 'criteria'],
        dateField: 'createdAt',
      }),
    );
  }

  /** Re-evaluates a dynamic segment's membership. */
  refreshSegment(id: string): Observable<AudienceSegment> {
    const index = mockDataset.segments.findIndex((segment) => segment.id === id);
    if (index === -1) {
      return this.backend.notFound<AudienceSegment>('Segment', id);
    }
    return this.backend.respond(() => {
      const current = mockDataset.segments[index] as AudienceSegment;
      const updated: AudienceSegment = {
        ...current,
        // Membership drifts a little on each refresh, as a live segment would.
        memberCount: Math.max(0, current.memberCount + Math.round((Math.random() - 0.45) * 400)),
        lastRefreshedAt: new Date().toISOString(),
      };
      mockDataset.segments[index] = updated;
      return updated;
    });
  }

  // -------------------------------------------------------------- campaigns

  campaigns(query: PageQuery): Observable<Page<NotificationCampaign>> {
    return this.backend.respond(() =>
      applyQuery(mockDataset.campaigns, query, {
        searchFields: ['name', 'code', 'templateName', 'segmentName', 'createdByName'],
        dateField: 'scheduledAt',
      }),
    );
  }

  setCampaignStatus(id: string, status: CampaignStatus): Observable<NotificationCampaign> {
    const index = mockDataset.campaigns.findIndex((campaign) => campaign.id === id);
    if (index === -1) {
      return this.backend.notFound<NotificationCampaign>('Campaign', id);
    }
    return this.backend.respond(() => {
      const now = new Date().toISOString();
      const updated: NotificationCampaign = {
        ...(mockDataset.campaigns[index] as NotificationCampaign),
        status,
        startedAt: status === CampaignStatus.Running ? now : mockDataset.campaigns[index]?.startedAt,
        completedAt: status === CampaignStatus.Completed ? now : undefined,
        updatedAt: now,
      };
      mockDataset.campaigns[index] = updated;
      return updated;
    });
  }

  // ------------------------------------------------------------- statistics

  templateStatistics(): Observable<StatMetric[]> {
    return this.backend.respond(() => {
      const templates = this.records;
      return [
        {
          id: 'templates',
          label: 'Templates',
          value: templates.length,
          icon: 'description',
          tone: 'primary',
        },
        {
          id: 'active',
          label: 'Active',
          value: templates.filter((template) => template.active).length,
          icon: 'check_circle',
          tone: 'success',
        },
        {
          id: 'usage',
          label: 'Messages sent',
          value: sumBy(templates, (template) => template.usageCount),
          icon: 'send',
          tone: 'info',
        },
        {
          id: 'segments',
          label: 'Audience segments',
          value: mockDataset.segments.length,
          icon: 'pie_chart',
          tone: 'neutral',
        },
      ];
    });
  }

  campaignStatistics(): Observable<StatMetric[]> {
    return this.backend.respond(() => {
      const campaigns = mockDataset.campaigns;
      const delivered = sumBy(campaigns, (campaign) => campaign.deliveredCount);
      const sent = sumBy(campaigns, (campaign) => campaign.sentCount) || 1;

      return [
        { id: 'campaigns', label: 'Campaigns', value: campaigns.length, icon: 'campaign', tone: 'primary' },
        {
          id: 'running',
          label: 'Running',
          value: campaigns.filter((campaign) => campaign.status === CampaignStatus.Running).length,
          icon: 'play_circle',
          tone: 'success',
        },
        {
          id: 'scheduled',
          label: 'Scheduled',
          value: campaigns.filter((campaign) => campaign.status === CampaignStatus.Scheduled).length,
          icon: 'schedule_send',
          tone: 'info',
        },
        {
          id: 'delivered',
          label: 'Messages delivered',
          value: delivered,
          icon: 'mark_email_read',
          tone: 'success',
        },
        {
          id: 'rate',
          label: 'Delivery rate',
          value: Math.round((delivered / sent) * 1000) / 10,
          formatted: `${Math.round((delivered / sent) * 1000) / 10}%`,
          icon: 'percent',
          tone: 'primary',
        },
        {
          id: 'failed',
          label: 'Failed',
          value: sumBy(campaigns, (campaign) => campaign.failedCount),
          icon: 'error',
          tone: 'danger',
        },
      ];
    });
  }
}
