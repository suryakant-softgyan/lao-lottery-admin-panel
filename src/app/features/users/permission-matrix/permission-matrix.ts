import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PERMISSIONS, PERMISSION_MODULES } from '@core/constants/permission.constants';
import type { Role } from '@core/models';
import { ConfirmService } from '@core/services/confirm.service';
import { ToastService } from '@core/services/toast.service';
import { humanise } from '@core/utilities/format.util';
import { PageHeader } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { UserRepository } from '../data/user.repository';

interface MatrixRow {
  code: string;
  action: string;
  sensitive: boolean;
}

interface MatrixModule {
  key: string;
  label: string;
  icon: string;
  rows: MatrixRow[];
}

/** Permission codes whose grant should be deliberate rather than incidental. */
const SENSITIVE = new Set<string>([
  PERMISSIONS.draws.rollback,
  PERMISSIONS.draws.publish,
  PERMISSIONS.wallet.adjust,
  PERMISSIONS.wallet.credit,
  PERMISSIONS.wallet.debit,
  PERMISSIONS.payment.refund,
  PERMISSIONS.users.impersonate,
  PERMISSIONS.users.delete,
  PERMISSIONS.settings.tenants,
  PERMISSIONS.roles.assignPermissions,
]);

/**
 * Role × permission matrix.
 *
 * The whole RBAC configuration on one screen, grouped by module with a sticky
 * header and leading column so a wide grid stays navigable. Edits are staged
 * locally and only committed on save, so a mis-click never changes live access.
 */
@Component({
  selector: 'll-permission-matrix',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatTooltipModule,
    PageHeader,
    Skeleton,
    StatePanel,
  ],
  templateUrl: './permission-matrix.html',
  styleUrl: './permission-matrix.scss',
})
export class PermissionMatrix {
  private readonly repository = inject(UserRepository);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly roles = signal<Role[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Staged state: roleId → set of permission codes. */
  protected readonly draft = signal<Record<string, Set<string>>>({});

  protected readonly search = signal('');

  /** Full catalogue grouped by module. */
  private readonly allModules = computed<MatrixModule[]>(() =>
    PERMISSION_MODULES.map((module) => {
      const group = (PERMISSIONS as unknown as Record<string, Record<string, string>>)[module.key] ?? {};
      return {
        key: module.key,
        label: module.label,
        icon: module.icon,
        rows: Object.values(group).map((code) => ({
          code,
          action: humanise(code.split('.')[1] ?? code),
          sensitive: SENSITIVE.has(code),
        })),
      };
    }),
  );

  protected readonly modules = computed<MatrixModule[]>(() => {
    const needle = this.search().trim().toLowerCase();
    if (!needle) {
      return this.allModules();
    }
    return this.allModules()
      .map((module) => ({
        ...module,
        rows: module.rows.filter(
          (row) =>
            row.code.toLowerCase().includes(needle) ||
            row.action.toLowerCase().includes(needle) ||
            module.label.toLowerCase().includes(needle),
        ),
      }))
      .filter((module) => module.rows.length > 0);
  });

  /** True when the staged state differs from what was loaded. */
  protected readonly dirty = signal(false);

  protected readonly grantedCount = computed(() => {
    const draft = this.draft();
    return Object.fromEntries(this.roles().map((role) => [role.id, draft[role.id]?.size ?? 0])) as Record<
      string,
      number
    >;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.repository.roles().subscribe({
      next: (roles) => {
        const ordered = [...roles].sort((a, b) => a.level - b.level);
        this.roles.set(ordered);
        this.draft.set(Object.fromEntries(ordered.map((role) => [role.id, new Set(role.permissionCodes)])));
        this.dirty.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('The permission matrix could not be loaded.');
      },
    });
  }

  protected isGranted(roleId: string, code: string): boolean {
    return this.draft()[roleId]?.has(code) ?? false;
  }

  protected toggle(roleId: string, code: string): void {
    this.draft.update((current) => {
      const next = { ...current };
      const set = new Set(next[roleId] ?? []);
      if (set.has(code)) {
        set.delete(code);
      } else {
        set.add(code);
      }
      next[roleId] = set;
      return next;
    });
    this.dirty.set(true);
  }

  /** Grants or revokes an entire module for one role in a single action. */
  protected toggleModule(roleId: string, module: MatrixModule): void {
    const allGranted = module.rows.every((row) => this.isGranted(roleId, row.code));
    this.draft.update((current) => {
      const next = { ...current };
      const set = new Set(next[roleId] ?? []);
      for (const row of module.rows) {
        if (allGranted) {
          set.delete(row.code);
        } else {
          set.add(row.code);
        }
      }
      next[roleId] = set;
      return next;
    });
    this.dirty.set(true);
  }

  protected moduleState(roleId: string, module: MatrixModule): 'none' | 'some' | 'all' {
    const granted = module.rows.filter((row) => this.isGranted(roleId, row.code)).length;
    if (granted === 0) {
      return 'none';
    }
    return granted === module.rows.length ? 'all' : 'some';
  }

  /** Restores a role to the shipped default for its code. */
  protected resetRole(role: Role): void {
    this.draft.update((current) => ({
      ...current,
      [role.id]: new Set(this.repository.defaultPermissionsFor(String(role.code))),
    }));
    this.dirty.set(true);
    this.toast.info('Defaults restored', `${role.name} reset to the shipped permission set.`);
  }

  protected save(): void {
    this.confirm
      .ask({
        title: 'Apply permission changes?',
        message:
          'Access changes take effect immediately for every affected user, including anyone currently signed in.',
        detail: 'The full before/after diff is written to the audit trail.',
        confirmLabel: 'Apply changes',
        tone: 'warning',
        icon: 'lock_person',
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.saving.set(true);
        const draft = this.draft();
        const updates = this.roles().map((role) =>
          this.repository.saveRolePermissions(role.id, [...(draft[role.id] ?? [])]),
        );

        // Sequential completion is fine here — the set is small and bounded.
        let completed = 0;
        for (const update of updates) {
          update.subscribe({
            next: () => {
              completed++;
              if (completed === updates.length) {
                this.saving.set(false);
                this.dirty.set(false);
                this.toast.success('Permissions updated', `${updates.length} role(s) saved.`);
              }
            },
            error: () => {
              this.saving.set(false);
              this.toast.error('Save failed', 'Some roles could not be updated.');
            },
          });
        }
      });
  }

  protected discard(): void {
    this.load();
    this.toast.info('Changes discarded');
  }
}
