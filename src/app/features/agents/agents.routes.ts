import type { Routes } from '@angular/router';

import { PERMISSIONS } from '@core/constants/permission.constants';
import { permissionGuard } from '@core/guards/permission.guard';

export const AGENTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Agents',
    data: { breadcrumb: '' },
    loadComponent: () => import('./agent-list/agent-list').then((m) => m.AgentList),
  },
  {
    path: 'approvals',
    title: 'Agent Approvals',
    data: { breadcrumb: 'Approvals', permissions: [PERMISSIONS.agents.approve] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./agent-approvals/agent-approvals').then((m) => m.AgentApprovals),
  },
  {
    path: 'commission',
    title: 'Commission Plans',
    data: { breadcrumb: 'Commission', permissions: [PERMISSIONS.agents.commission] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./commission-plans/commission-plans').then((m) => m.CommissionPlans),
  },
  {
    path: 'performance',
    title: 'Agent Performance',
    data: { breadcrumb: 'Performance' },
    loadComponent: () => import('./agent-performance/agent-performance').then((m) => m.AgentPerformance),
  },
  {
    path: 'details/:id',
    title: 'Agent Details',
    data: { breadcrumb: 'Details' },
    loadComponent: () => import('./agent-detail/agent-detail').then((m) => m.AgentDetail),
  },
];
