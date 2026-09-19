import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';

import { num } from '@core/api/live.util';

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
    if (this.live) {
      return this.liveSegments().pipe(map((rows) => applyQuery(rows, query, { searchFields: ["name", "code", "description", "criteria"], dateField: "createdAt" })));
    }
    return this.backend.respond(() =>
      applyQuery(mockDataset.segments, query, {
        searchFields: ['name', 'code', 'description', 'criteria'],
        dateField: 'createdAt',
      }),
    );
  }

  /** Re-evaluates a dynamic segment's membership. */
  refreshSegment(id: string): Observable<AudienceSegment> {
    if (this.live) {
      return this.liveSegments().pipe(map((rows) => this.requireSegment(rows, id)));
    }
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
    if (this.live) {
      return this.livePage("admin/notifications/campaigns", query, (row) => this.campaignFromApi(row));
    }
    return this.backend.respond(() =>
      applyQuery(mockDataset.campaigns, query, {
        searchFields: ['name', 'code', 'templateName', 'segmentName', 'createdByName'],
        dateField: 'scheduledAt',
      }),
    );
  }

  setCampaignStatus(id: string, status: CampaignStatus): Observable<NotificationCampaign> {
    if (this.live) {
      return this.liveCampaignStatus(id, status);
    }
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
    if (this.live) {
      return this.liveTemplateStatistics();
    }
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
    if (this.live) {
      return this.liveCampaignStatistics();
    }
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
  // =====================================================================================
  // Live API implementation
  // =====================================================================================

  protected override get livePath(): string {
    return 'admin/notifications/templates';
  }

  protected override fromApi(record: unknown): NotificationTemplate {
    const api = record as NotificationTemplate & { language?: string };
    const body = api.body ?? '';
    return {
      ...api,
      subject: api.subject ?? '',
      body,
      variables: [...new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] as string))],
      usageCount: api.usageCount ?? 0,
      createdAt: api.createdAt ?? new Date().toISOString(),
    };
  }

  protected override toApi(payload: Partial<NotificationTemplate>): unknown {
    return {
      code: payload.code,
      name: payload.name,
      channel: payload.channel,
      category: payload.category,
      language: (payload as { language?: string }).language ?? 'en',
      subject: payload.subject,
      body: payload.body,
      active: payload.active ?? true,
    };
  }

  /** The API has no partial update for templates: re-send the remembered template with the change. */
  protected override livePatch(id: string, changes: Partial<NotificationTemplate>): Observable<NotificationTemplate> {
    const current = this.records.find((template) => template.id === id);
    if (!current) {
      return throwError(() => new Error('Reload the template list and try again.'));
    }
    return this.update(id, { ...current, ...changes });
  }

  private static readonly SEGMENT_LABELS: Record<string, [string, string]> = {
    ALL_CUSTOMERS: ['All customers', 'Every active player account'],
    KYC_APPROVED: ['Verified players', 'Players whose identity (KYC) is approved'],
    KYC_PENDING: ['Unverified players', 'Players who have not completed KYC'],
    NEW_THIS_MONTH: ['New this month', 'Players registered in the last 30 days'],
    INACTIVE_30_DAYS: ['Inactive 30 days', 'Players who have not signed in for 30 days'],
    LOYALTY_GOLD_PLUS: ['Gold & Platinum', 'Players in the Gold or Platinum loyalty tier'],
    AGENTS: ['Agents', 'Every active agent login'],
    RETAILERS: ['Retailers', 'Every active retailer login'],
    STAFF: ['Staff', 'Back-office users'],
  };

  /** Segments are rule based on the API (always "dynamic"): the size is computed on every read. */
  private liveSegments(): Observable<AudienceSegment[]> {
    return this.http.get<{ code: string; size: number }[]>(this.api('admin/notifications/segments')).pipe(
      map((segments) =>
        segments.map((segment) => {
          const [name, description] = NotificationRepository.SEGMENT_LABELS[segment.code] ?? [segment.code, ''];
          const now = new Date().toISOString();
          return {
            id: segment.code,
            code: segment.code,
            name,
            description,
            criteria: description,
            memberCount: segment.size,
            dynamic: true,
            lastRefreshedAt: now,
            createdAt: now,
          };
        }),
      ),
    );
  }

  private requireSegment(segments: AudienceSegment[], id: string): AudienceSegment {
    const segment = segments.find((item) => item.id === id);
    if (!segment) {
      throw new Error(`Segment ${id} was not found.`);
    }
    return segment;
  }

  private campaignFromApi(record: unknown): NotificationCampaign {
    const api = record as Record<string, unknown>;
    const segment = String(api['segment'] ?? '');
    return {
      id: String(api['id']),
      code: `CMP-${String(api['id']).slice(0, 8).toUpperCase()}`,
      name: String(api['name'] ?? ''),
      channels: [api['channel'] as NotificationCampaign['channels'][number]],
      templateId: '',
      templateName: String(api['title'] ?? ''),
      segmentId: segment,
      segmentName: NotificationRepository.SEGMENT_LABELS[segment]?.[0] ?? segment,
      status: api['status'] as CampaignStatus,
      scheduledAt: (api['scheduledAt'] as string | undefined) ?? undefined,
      startedAt: (api['startedAt'] as string | undefined) ?? undefined,
      completedAt: (api['completedAt'] as string | undefined) ?? undefined,
      targetCount: num(api['targetCount']),
      sentCount: num(api['sentCount']),
      deliveredCount: num(api['sentCount']),
      openedCount: 0,
      failedCount: num(api['failedCount']),
      createdByName: String(api['createdBy'] ?? ''),
      createdAt: String(api['createdAt'] ?? ''),
    };
  }

  private liveCampaignStatus(id: string, status: CampaignStatus): Observable<NotificationCampaign> {
    const action =
      status === CampaignStatus.Running ? 'launch' : status === CampaignStatus.Cancelled ? 'cancel' : null;
    if (!action) {
      return throwError(() => new Error('The API can launch or cancel a campaign; pausing is not supported.'));
    }
    return this.http
      .post<unknown>(this.api(`admin/notifications/campaigns/${id}/${action}`), {})
      .pipe(map((row) => this.campaignFromApi(row)));
  }

  private liveTemplateStatistics(): Observable<StatMetric[]> {
    return this.all().pipe(
      map((templates) => {
        const byChannel = (channel: string): number => templates.filter((t) => t.channel === channel).length;
        return [
          { id: 'total', label: 'Templates', value: templates.length, icon: 'description', tone: 'primary' as const },
          { id: 'active', label: 'Active', value: templates.filter((t) => t.active).length, icon: 'check_circle', tone: 'success' as const },
          { id: 'push', label: 'Push', value: byChannel('PUSH'), icon: 'notifications', tone: 'info' as const },
          { id: 'sms', label: 'SMS', value: byChannel('SMS'), icon: 'sms', tone: 'warning' as const },
          { id: 'email', label: 'Email', value: byChannel('EMAIL'), icon: 'mail', tone: 'neutral' as const },
        ];
      }),
    );
  }

  private liveCampaignStatistics(): Observable<StatMetric[]> {
    return this.livePage('admin/notifications/campaigns', { page: 0, size: 200 }, (row) => this.campaignFromApi(row)).pipe(
      map((page) => {
        const campaigns = page.content;
        const count = (status: CampaignStatus): number => campaigns.filter((c) => c.status === status).length;
        return [
          { id: 'total', label: 'Campaigns', value: page.totalElements, icon: 'campaign', tone: 'primary' as const },
          { id: 'running', label: 'Running', value: count(CampaignStatus.Running), icon: 'play_circle', tone: 'success' as const },
          { id: 'scheduled', label: 'Scheduled', value: count(CampaignStatus.Scheduled), icon: 'event', tone: 'info' as const },
          { id: 'sent', label: 'Messages sent', value: campaigns.reduce((sum, c) => sum + c.sentCount, 0), icon: 'send', tone: 'neutral' as const },
          { id: 'failed', label: 'Failed', value: campaigns.reduce((sum, c) => sum + c.failedCount, 0), icon: 'error', tone: 'danger' as const },
        ];
      }),
    );
  }
}
