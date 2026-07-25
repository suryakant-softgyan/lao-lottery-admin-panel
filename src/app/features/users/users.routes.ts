import type { Routes } from '@angular/router';

import { PERMISSIONS } from '@core/constants/permission.constants';
import { permissionGuard } from '@core/guards/permission.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    title: 'Users',
    data: { breadcrumb: '' },
    loadComponent: () => import('./user-list/user-list').then((m) => m.UserList),
  },
  {
    path: 'roles',
    title: 'Roles',
    data: { breadcrumb: 'Roles', permissions: [PERMISSIONS.roles.view] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./role-list/role-list').then((m) => m.RoleList),
  },
  {
    path: 'permissions',
    title: 'Permission Matrix',
    data: { breadcrumb: 'Permission matrix', permissions: [PERMISSIONS.roles.assignPermissions] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./permission-matrix/permission-matrix').then((m) => m.PermissionMatrix),
  },
  {
    path: 'verification',
    title: 'Verification Queue',
    data: { breadcrumb: 'Verification', permissions: [PERMISSIONS.users.approve] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./verification-queue/verification-queue').then((m) => m.VerificationQueue),
  },
  {
    path: 'create',
    title: 'Create User',
    data: { breadcrumb: 'Create', permissions: [PERMISSIONS.users.create] },
    canActivate: [permissionGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./user-form/user-form').then((m) => m.UserForm),
  },
  {
    path: 'edit/:id',
    title: 'Edit User',
    data: { breadcrumb: 'Edit', permissions: [PERMISSIONS.users.update] },
    canActivate: [permissionGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./user-form/user-form').then((m) => m.UserForm),
  },
  {
    path: 'details/:id',
    title: 'User Details',
    data: { breadcrumb: 'Details' },
    loadComponent: () => import('./user-detail/user-detail').then((m) => m.UserDetail),
  },
];
