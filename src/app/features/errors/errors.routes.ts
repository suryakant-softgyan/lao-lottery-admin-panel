import type { Routes } from '@angular/router';

export const ERROR_ROUTES: Routes = [
  {
    path: '403',
    title: 'Access denied',
    data: { code: 403, breadcrumb: 'Access denied' },
    loadComponent: () => import('./error-page').then((m) => m.ErrorPage),
  },
  {
    path: '404',
    title: 'Page not found',
    data: { code: 404, breadcrumb: 'Not found' },
    loadComponent: () => import('./error-page').then((m) => m.ErrorPage),
  },
  {
    path: '500',
    title: 'Server error',
    data: { code: 500, breadcrumb: 'Server error' },
    loadComponent: () => import('./error-page').then((m) => m.ErrorPage),
  },
  {
    path: 'maintenance',
    title: 'Maintenance',
    data: { code: 503, breadcrumb: 'Maintenance' },
    loadComponent: () => import('./error-page').then((m) => m.ErrorPage),
  },
  { path: '', pathMatch: 'full', redirectTo: '404' },
];
