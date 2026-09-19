import type { Routes } from '@angular/router';

/**
 * Unauthenticated routes.
 *
 * All of them render inside {@link AuthLayout}, which supplies the branded
 * split-screen/glass/minimal treatment selected on the Appearance page.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./auth-layout/auth-layout').then((m) => m.AuthLayout),
    children: [
      {
        path: 'login',
        title: 'Sign in',
        loadComponent: () => import('./login/login').then((m) => m.Login),
      },
      {
        path: 'forgot-password',
        title: 'Forgot password',
        loadComponent: () => import('./forgot-password/forgot-password').then((m) => m.ForgotPassword),
      },
      {
        path: 'verify',
        title: 'Verification',
        loadComponent: () => import('./otp-verification/otp-verification').then((m) => m.OtpVerification),
      },
      {
        path: 'reset-password',
        title: 'Reset password',
        loadComponent: () => import('./reset-password/reset-password').then((m) => m.ResetPassword),
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
    ],
  },
];
