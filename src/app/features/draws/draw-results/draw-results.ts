import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { AuthService } from '@core/authentication/auth.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { DRAW_STATUS_MAP, LOTTERY_TYPE_MAP, toOptions } from '@core/constants/status-maps.constants';
import { DrawStatus } from '@core/enums';
import type { Draw, Page, PageQuery } from '@core/models';
import type { TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ConfirmService } from '@core/services/confirm.service';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { DrawRepository } from '../data/draw.repository';

/**
 * Results and verification worklist.
 *
 * The four-eyes control point: a draw is verified by one operator and published
 * by another, and both names are recorded against the result.
 */
@Component({
  selector: 'll-draw-results',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Results & Verification"
        eyebrow="Draw Operations"
        subtitle="Drawn results awaiting verification, and the published record of every completed draw."
        icon="fact_check"
        [stats]="[{ label: 'Results', value: total().toLocaleString(), icon: 'fact_check' }]"
        [actions]="[
          { id: 'back', label: 'All draws', icon: 'stadia_controller', variant: 'secondary' },
          { id: 'live', label: 'Live studio', icon: 'sensors', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      <ll-list-toolbar
        searchPlaceholder="Search results by draw code or product…"
        [quickFilters]="quickFilters"
        [showDateRange]="true"
        [refreshing]="loading()"
        (searchChange)="onSearch($event)"
        (quickChange)="onQuickFilter($event)"
        (rangeChange)="onDateRange($event)"
        (refresh)="reload()"
        (export)="onExport($event)"
        (clear)="onClearFilters()" />

      <ll-data-table
        tableId="draw-results"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [selectable]="false"
        emptyTitle="No results yet"
        emptyMessage="Executed draws appear here for verification and publication."
        (sortChange)="onSort($event)"
        (pageChange)="onPage($event)"
        (rowAction)="onRowAction($event)"
        (rowClick)="openDetail($event)"
        (retry)="reload()" />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class DrawResults extends ListPageBase<Draw> {
  private readonly repository = inject(DrawRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly entityLabel = 'Draw Results';

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(DRAW_STATUS_MAP) },
    { key: 'lotteryType', label: 'Product', icon: 'casino', options: toOptions(LOTTERY_TYPE_MAP) },
  ];

  protected readonly columns: TableColumn<Draw>[] = [
    {
      key: 'code',
      label: 'Draw',
      sortable: true,
      sticky: 'start',
      minWidth: 210,
      locked: true,
      subLabel: (row) => row.lotteryName,
    },
    {
      key: 'winningNumbers',
      label: 'Winning numbers',
      minWidth: 220,
      sortable: false,
      value: (row) => row.winningNumbers.map((tier) => tier.numbers.join('')).join(' · '),
      cellClass: () => 'll-mono',
    },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: DRAW_STATUS_MAP,
      minWidth: 180,
    },
    { key: 'drawnAt', label: 'Drawn', type: 'datetime', sortable: true, minWidth: 170 },
    {
      key: 'verification.verifiedBy',
      label: 'Verified by',
      minWidth: 170,
      value: (row) => row.verification.verifiedBy ?? '—',
    },
    {
      key: 'verification.approvedBy',
      label: 'Approved by',
      minWidth: 170,
      value: (row) => row.verification.approvedBy ?? '—',
    },
    { key: 'winnerCount', label: 'Winners', type: 'number', sortable: true, minWidth: 110 },
    { key: 'payoutAmount', label: 'Payout', type: 'currency', sortable: true, minWidth: 150 },
    { key: 'taxCollected', label: 'Tax', type: 'currency', sortable: true, minWidth: 140 },
    {
      key: 'verification.checksum',
      label: 'Checksum',
      minWidth: 190,
      value: (row) => row.verification.checksum,
      cellClass: () => 'll-mono',
    },
    { key: 'publishedAt', label: 'Published', type: 'relative', sortable: true, minWidth: 150 },
  ];

  protected readonly rowActions: TableAction<Draw>[] = [
    { id: 'view', label: 'View result', icon: 'visibility', primary: true, tone: 'primary' },
    {
      id: 'verify',
      label: 'Verify result',
      icon: 'fact_check',
      tone: 'success',
      permissions: [PERMISSIONS.draws.verify],
      visible: (row) => row.status === DrawStatus.PendingVerification && !row.verification.verifiedAt,
    },
    {
      id: 'publish',
      label: 'Publish result',
      icon: 'campaign',
      tone: 'success',
      permissions: [PERMISSIONS.draws.publish],
      visible: (row) => row.status === DrawStatus.PendingVerification,
    },
    {
      id: 'rollback',
      label: 'Roll back draw',
      icon: 'undo',
      tone: 'danger',
      permissions: [PERMISSIONS.draws.rollback],
      visible: (row) => row.status === DrawStatus.Published,
      divider: true,
    },
  ];

  constructor() {
    super();
    this.patchQuery({ sort: { active: 'drawnAt', direction: 'desc' as never } });
    this.initialise();
  }

  protected fetch(query: PageQuery): Observable<Page<Draw>> {
    return this.repository.results(query);
  }

  protected openDetail(row: Draw): void {
    void this.router.navigate(['/draws/details', row.id]);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/draws']);
    } else if (action === 'live') {
      void this.router.navigate(['/draws/live']);
    }
  }

  protected onRowAction(event: TableActionEvent<Draw>): void {
    const { action, row } = event;
    const actor = this.auth.user()?.fullName ?? 'Operator';

    switch (action) {
      case 'view':
        this.openDetail(row);
        break;
      case 'verify':
        this.confirm
          .open({
            title: 'Verify this result?',
            message: `Confirm the drawn numbers for ${row.code} match the RNG log and witness record.`,
            detail: `Checksum ${row.verification.checksum}`,
            confirmLabel: 'Verify result',
            tone: 'primary',
            icon: 'fact_check',
            requireReason: true,
            reasonLabel: 'Verification remarks (optional)',
          })
          .subscribe((result) => {
            if (result.confirmed) {
              this.repository.verify(row.id, actor, result.reason).subscribe(() => {
                this.toast.success('Result verified', row.code);
                this.reload();
              });
            }
          });
        break;
      case 'publish':
        // Four-eyes: the verifier may not also be the approver.
        if (row.verification.verifiedBy === actor) {
          this.toast.warning(
            'Separate approval required',
            'A result must be published by someone other than the operator who verified it.',
          );
          return;
        }
        this.confirm
          .ask({
            title: 'Publish this result?',
            message: `Results for ${row.code} become visible to customers and prize payouts are released.`,
            detail: `Verified by ${row.verification.verifiedBy ?? 'nobody yet'}.`,
            confirmLabel: 'Publish result',
            tone: 'primary',
            icon: 'campaign',
          })
          .subscribe((confirmed) => {
            if (confirmed) {
              this.repository.publish(row.id, actor).subscribe(() => {
                this.toast.success('Result published', row.code);
                this.reload();
              });
            }
          });
        break;
      case 'rollback':
        this.confirm
          .open({
            title: 'Roll back this published draw?',
            message:
              'Published results will be withdrawn and any payouts already released must be recovered manually.',
            detail: 'This is one of the most sensitive actions in the platform and is fully audited.',
            confirmLabel: 'Roll back draw',
            tone: 'danger',
            icon: 'undo',
            requireTypedConfirmation: 'ROLLBACK',
            requireReason: true,
            reasonLabel: 'Reason for rollback',
          })
          .subscribe((result) => {
            if (result.confirmed && result.reason) {
              this.repository.rollback(row.id, result.reason).subscribe(() => {
                this.toast.warning('Draw rolled back', row.code);
                this.reload();
              });
            }
          });
        break;
      default:
        break;
    }
  }
}
