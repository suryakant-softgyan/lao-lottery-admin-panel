import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PermissionService } from '@core/authentication/permission.service';
import { PERMISSIONS, PERMISSION_MODULES } from '@core/constants/permission.constants';
import { USER_STATUS_MAP } from '@core/constants/status-maps.constants';
import type { Role } from '@core/models';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { PageHeader } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { DatePipe } from '@shared/pipes/format.pipes';
import { UserRepository } from '../data/user.repository';

/**
 * Role catalogue.
 *
 * Presented as cards rather than a table: a role is defined by its permission
 * *shape*, and a card can show the module coverage at a glance where a row of
 * cells cannot.
 */
@Component({
  selector: 'll-role-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    MatTooltipModule,
    PageHeader,
    StatusBadge,
    Skeleton,
    StatePanel,
    DatePipe,
  ],
  templateUrl: './role-list.html',
  styleUrl: './role-list.scss',
})
export class RoleList {
  private readonly repository = inject(UserRepository);
  private readonly router = inject(Router);
  protected readonly permissions = inject(PermissionService);

  protected readonly statusMap = USER_STATUS_MAP;
  protected readonly modules = PERMISSION_MODULES;

  protected readonly roles = signal<Role[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly canEdit = computed(() => this.permissions.has(PERMISSIONS.roles.assignPermissions));

  protected readonly totalPermissions = computed(() =>
    this.modules.reduce((total, module) => total + this.moduleCount(module.key), 0),
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.repository.roles().subscribe({
      next: (roles) => {
        this.roles.set([...roles].sort((a, b) => a.level - b.level));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Roles could not be loaded.');
      },
    });
  }

  /** Number of permissions the role holds within a module. */
  protected roleModuleCount(role: Role, moduleKey: string): number {
    return role.permissionCodes.filter((code) => code.startsWith(`${moduleKey}.`)).length;
  }

  /** Total permissions defined for a module, used as the coverage denominator. */
  protected moduleCount(moduleKey: string): number {
    const counts = new Set<string>();
    for (const role of this.roles()) {
      for (const code of role.permissionCodes) {
        if (code.startsWith(`${moduleKey}.`)) {
          counts.add(code);
        }
      }
    }
    return counts.size;
  }

  protected coverage(role: Role, moduleKey: string): number {
    const total = this.moduleCount(moduleKey);
    return total === 0 ? 0 : Math.round((this.roleModuleCount(role, moduleKey) / total) * 100);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'matrix') {
      void this.router.navigate(['/users/permissions']);
    } else if (action === 'back') {
      void this.router.navigate(['/users']);
    }
  }
}
