import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ALL_PERMISSIONS } from '@core/constants/permission.constants';
import { LANGUAGES, VALIDATION_LIMITS } from '@core/constants/app.constants';
import { ROLE_MAP, USER_STATUS_MAP, toOptions } from '@core/constants/status-maps.constants';
import { Gender, UserType } from '@core/enums';
import type { User, UserPayload } from '@core/models';
import { BreadcrumbService } from '@core/services/breadcrumb.service';
import { ToastService } from '@core/services/toast.service';
import { humanise } from '@core/utilities/format.util';
import type { HasUnsavedChanges } from '@core/guards/unsaved-changes.guard';
import { DynamicForm } from '@shared/components/dynamic-form/dynamic-form';
import type { FormSchema } from '@shared/components/dynamic-form/dynamic-form.model';
import { PageHeader } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { AppValidators } from '@shared/validators/app.validators';
import { UserRepository } from '../data/user.repository';

/**
 * Create / edit user.
 *
 * The same component serves both routes — presence of an `:id` parameter
 * decides the mode. The form itself is declared as a {@link FormSchema} and
 * rendered by {@link DynamicForm}, so validation, layout and error messaging
 * match every other form in the portal.
 */
@Component({
  selector: 'll-user-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, DynamicForm, Skeleton, StatePanel],
  template: `
    <div class="ll-page">
      <ll-page-header
        [title]="isEdit() ? 'Edit user' : 'Create user'"
        eyebrow="User Management"
        [subtitle]="
          isEdit()
            ? 'Update the profile, role assignment and access settings for this account.'
            : 'Set up a new staff or customer account and assign the appropriate role.'
        "
        icon="manage_accounts"
        [compact]="true"
        [actions]="[{ id: 'back', label: 'Back to list', icon: 'arrow_back', variant: 'secondary' }]"
        (actionSelected)="onHeaderAction($event)" />

      <div class="ll-card">
        <div class="ll-card__body">
          @if (loading()) {
            <ll-skeleton variant="card" [count]="2" />
          } @else if (errorMessage(); as message) {
            <ll-state-panel kind="error" [message]="message" [showRetry]="true" (retry)="load()" />
          } @else {
            <ll-dynamic-form
              [schema]="schema()"
              [value]="model()"
              [submitting]="saving()"
              [submitLabel]="isEdit() ? 'Save changes' : 'Create user'"
              (formSubmit)="save($event)"
              (cancelled)="cancel()" />
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class UserForm implements HasUnsavedChanges {
  private readonly repository = inject(UserRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly breadcrumb = inject(BreadcrumbService);

  private readonly form = viewChild(DynamicForm);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly model = signal<Record<string, unknown> | null>(null);

  private readonly userId = signal<string | null>(this.route.snapshot.paramMap.get('id'));

  protected readonly isEdit = computed(() => this.userId() !== null);

  protected readonly schema = computed<FormSchema>(() => ({
    sections: [
      {
        id: 'identity',
        title: 'Personal details',
        description: 'Basic identity information used across the platform.',
        icon: 'badge',
        fields: [
          {
            key: 'firstName',
            label: 'First name',
            type: 'text',
            required: true,
            span: 6,
            maxLength: VALIDATION_LIMITS.nameMax,
          },
          {
            key: 'lastName',
            label: 'Last name',
            type: 'text',
            required: true,
            span: 6,
            maxLength: VALIDATION_LIMITS.nameMax,
          },
          {
            key: 'gender',
            label: 'Gender',
            type: 'select',
            span: 4,
            options: Object.values(Gender).map((value) => ({ value, label: humanise(value) })),
          },
          { key: 'dateOfBirth', label: 'Date of birth', type: 'date', span: 4 },
          {
            key: 'nationalId',
            label: 'National ID',
            type: 'text',
            span: 4,
            hint: 'Lao national identity number',
          },
        ],
      },
      {
        id: 'contact',
        title: 'Contact & access',
        description: 'Sign-in identity and how the platform reaches this person.',
        icon: 'contact_mail',
        fields: [
          {
            key: 'username',
            label: 'Username',
            type: 'text',
            required: true,
            span: 6,
            icon: 'person',
            validators: [AppValidators.username()],
            hint: '4–32 characters: letters, numbers, dots, hyphens or underscores',
            disabled: this.isEdit(),
          },
          { key: 'email', label: 'Email address', type: 'email', required: true, span: 6, icon: 'mail' },
          {
            key: 'phone',
            label: 'Mobile number',
            type: 'phone',
            required: true,
            span: 6,
            icon: 'phone',
            hint: 'Lao mobile, e.g. +856 20 5555 1234',
          },
          {
            key: 'language',
            label: 'Preferred language',
            type: 'select',
            span: 3,
            options: LANGUAGES.map((language) => ({ value: language.value, label: language.label })),
          },
          {
            key: 'timezone',
            label: 'Time zone',
            type: 'select',
            span: 3,
            options: [
              { value: 'Asia/Vientiane', label: 'Asia/Vientiane (ICT)' },
              { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT)' },
              { value: 'UTC', label: 'UTC' },
            ],
          },
        ],
      },
      {
        id: 'role',
        title: 'Role & organisation',
        description: 'Determines which modules and actions this account can reach.',
        icon: 'admin_panel_settings',
        fields: [
          {
            key: 'type',
            label: 'Account type',
            type: 'select',
            required: true,
            span: 4,
            options: Object.values(UserType).map((value) => ({ value, label: humanise(value) })),
          },
          {
            key: 'primaryRole',
            label: 'Primary role',
            type: 'select',
            required: true,
            span: 4,
            options: toOptions(ROLE_MAP),
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            required: true,
            span: 4,
            options: toOptions(USER_STATUS_MAP),
          },
          {
            key: 'roles',
            label: 'Additional roles',
            type: 'multiselect',
            span: 6,
            options: toOptions(ROLE_MAP),
            hint: 'Optional — grants the union of every selected role',
          },
          {
            key: 'permissionOverrides',
            label: 'Permission overrides',
            type: 'multiselect',
            span: 6,
            options: ALL_PERMISSIONS.map((code) => ({ value: code, label: code })),
            hint: 'Extra permissions on top of the role. Use sparingly — every grant is audited.',
          },
          { key: 'department', label: 'Department', type: 'text', span: 4 },
          { key: 'designation', label: 'Designation', type: 'text', span: 4 },
          {
            key: 'reportsTo',
            label: 'Reports to',
            type: 'select',
            span: 4,
            options: this.repository.managerOptions(),
          },
        ],
      },
      {
        id: 'address',
        title: 'Address',
        icon: 'home',
        fields: [
          { key: 'addressLine1', label: 'Address line', type: 'text', span: 6 },
          { key: 'addressVillage', label: 'Village', type: 'text', span: 6 },
          { key: 'addressDistrict', label: 'District', type: 'text', span: 4 },
          { key: 'addressProvince', label: 'Province', type: 'text', span: 4 },
          { key: 'addressPostalCode', label: 'Postal code', type: 'text', span: 4 },
        ],
      },
      {
        id: 'options',
        title: 'Options',
        icon: 'tune',
        fields: [
          {
            key: 'notes',
            label: 'Internal notes',
            type: 'textarea',
            span: 12,
            rows: 3,
            maxLength: VALIDATION_LIMITS.notesMax,
          },
          {
            key: 'sendWelcomeEmail',
            label: 'Send a welcome email',
            type: 'toggle',
            span: 6,
            hint: 'Includes sign-in instructions and the one-time password',
            defaultValue: true,
          },
          {
            key: 'requirePasswordChange',
            label: 'Require password change at first sign-in',
            type: 'toggle',
            span: 6,
            defaultValue: true,
          },
        ],
      },
    ],
  }));

  constructor() {
    this.load();
  }

  hasUnsavedChanges(): boolean {
    return (this.form()?.isDirty() ?? false) && !this.saving();
  }

  protected load(): void {
    const id = this.userId();
    if (!id) {
      this.model.set({
        language: 'en',
        timezone: 'Asia/Vientiane',
        sendWelcomeEmail: true,
        requirePasswordChange: true,
        roles: [],
        permissionOverrides: [],
      });
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.repository.getById(id).subscribe({
      next: (user) => {
        this.breadcrumb.setDynamicLabel(user.fullName);
        this.model.set(this.toFormModel(user));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('This user could not be loaded. They may have been removed.');
      },
    });
  }

  /** Flattens the nested address so the schema can address it with flat keys. */
  private toFormModel(user: User): Record<string, unknown> {
    return {
      ...user,
      addressLine1: user.address?.line1 ?? '',
      addressVillage: user.address?.village ?? '',
      addressDistrict: user.address?.district ?? '',
      addressProvince: user.address?.province ?? '',
      addressPostalCode: user.address?.postalCode ?? '',
    };
  }

  private toPayload(value: Record<string, unknown>): UserPayload {
    return {
      firstName: String(value['firstName'] ?? ''),
      lastName: String(value['lastName'] ?? ''),
      username: String(value['username'] ?? ''),
      email: String(value['email'] ?? ''),
      phone: String(value['phone'] ?? ''),
      gender: value['gender'] as UserPayload['gender'],
      dateOfBirth: (value['dateOfBirth'] as string | null) ?? null,
      nationalId: (value['nationalId'] as string | null) ?? null,
      type: value['type'] as UserPayload['type'],
      primaryRole: String(value['primaryRole'] ?? ''),
      roles: (value['roles'] as string[]) ?? [],
      status: value['status'] as UserPayload['status'],
      department: (value['department'] as string | null) ?? null,
      designation: (value['designation'] as string | null) ?? null,
      reportsTo: (value['reportsTo'] as string | null) ?? null,
      language: String(value['language'] ?? 'en'),
      timezone: String(value['timezone'] ?? 'Asia/Vientiane'),
      address: {
        line1: String(value['addressLine1'] ?? ''),
        village: String(value['addressVillage'] ?? ''),
        district: String(value['addressDistrict'] ?? ''),
        province: String(value['addressProvince'] ?? ''),
        postalCode: String(value['addressPostalCode'] ?? ''),
        country: 'Lao PDR',
      },
      notes: (value['notes'] as string | null) ?? null,
      permissionOverrides: (value['permissionOverrides'] as string[]) ?? [],
      sendWelcomeEmail: Boolean(value['sendWelcomeEmail']),
      requirePasswordChange: Boolean(value['requirePasswordChange']),
    };
  }

  protected save(value: Record<string, unknown>): void {
    this.saving.set(true);
    const payload = this.toPayload(value);
    const id = this.userId();

    const request = id ? this.repository.update(id, payload) : this.repository.create(payload);

    request.subscribe({
      next: (user) => {
        this.saving.set(false);
        this.toast.success(id ? 'User updated' : 'User created', user.fullName);
        void this.router.navigate(['/users/details', user.id]);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Save failed', 'The user could not be saved. Please try again.');
      },
    });
  }

  protected cancel(): void {
    void this.router.navigate(['/users']);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      this.cancel();
    }
  }
}
