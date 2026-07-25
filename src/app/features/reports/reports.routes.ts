import type { Routes } from '@angular/router';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Report Centre',
    data: { breadcrumb: '' },
    loadComponent: () => import('./report-centre/report-centre').then((m) => m.ReportCentre),
  },
  {
    // One view renders every report; `:type` selects the definition.
    path: ':type',
    title: 'Report',
    data: { breadcrumb: 'Report' },
    loadComponent: () => import('./report-view/report-view').then((m) => m.ReportView),
  },
];
