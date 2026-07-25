import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap, throwError } from 'rxjs';

import { environment } from '@env/environment';
import { STORAGE_KEYS } from '../constants/app.constants';
import { LoginResult } from '../enums';
import type {
  AuthTokens,
  AuthenticatedUser,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  OtpVerifyRequest,
  ResetPasswordRequest,
} from '../models/auth.model';
import { LoggerService } from '../services/logger.service';
import { MockBackendService } from '../services/mock-backend.service';
import { StorageService } from '../services/storage.service';
import { DEMO_ACCOUNTS, type DemoAccount } from './demo-accounts.constants';
import { TokenService } from './token.service';

interface PendingChallenge {
  challengeId: string;
  account: DemoAccount;
  remember: boolean;
  /** The code the mock backend "sent" — surfaced on screen for demo purposes. */
  code: string;
}

/**
 * Authentication façade.
 *
 * State lives in signals so guards, the shell and any component read the same
 * source without subscriptions. Every method has an `environment.useMockData`
 * branch: the mock path mirrors the real contract exactly (same request shape,
 * same response shape, same errors), so going live means deleting the branch.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokens = inject(TokenService);
  private readonly storage = inject(StorageService);
  private readonly backend = inject(MockBackendService);
  private readonly logger = inject(LoggerService);

  private readonly currentUser = signal<AuthenticatedUser | null>(
    this.storage.get<AuthenticatedUser | null>(STORAGE_KEYS.currentUser, null),
  );

  /** Outstanding MFA challenge, cleared once verified or abandoned. */
  private challenge: PendingChallenge | null = null;

  /** Where to land after a successful sign-in. */
  private redirectUrl = '/dashboard';

  readonly user = this.currentUser.asReadonly();

  readonly isAuthenticated = computed(() => this.currentUser() !== null && this.tokens.hasToken());

  readonly displayName = computed(() => this.currentUser()?.fullName ?? 'Guest');

  readonly initials = computed(() => {
    const name = this.currentUser()?.fullName ?? '';
    return (
      name
        .split(' ')
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || '?'
    );
  });

  readonly rememberedUsername = signal<string>(this.storage.get<string>(STORAGE_KEYS.rememberedUser, ''));

  /** The OTP the mock backend generated, so the demo can be completed offline. */
  readonly demoOtp = signal<string>('');

  // ---------------------------------------------------------------- sign-in

  login(request: LoginRequest): Observable<LoginResponse> {
    if (!environment.useMockData) {
      return this.http
        .post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, request)
        .pipe(tap((response) => this.handleLoginResponse(response, request.rememberMe)));
    }

    return this.backend
      .respond(() => this.mockLogin(request))
      .pipe(
        map((response) => {
          if (response.result === LoginResult.InvalidCredentials) {
            throw new Error('Invalid username or password.');
          }
          return response;
        }),
        tap((response) => this.handleLoginResponse(response, request.rememberMe)),
      );
  }

  verifyOtp(request: OtpVerifyRequest): Observable<LoginResponse> {
    if (!environment.useMockData) {
      return this.http
        .post<LoginResponse>(`${environment.apiBaseUrl}/auth/verify-otp`, request)
        .pipe(tap((response) => this.handleLoginResponse(response, true)));
    }

    return this.backend
      .respond(() => this.mockVerifyOtp(request))
      .pipe(
        map((response) => {
          if (response.result !== LoginResult.Success) {
            throw new Error(response.message ?? 'The verification code is incorrect.');
          }
          return response;
        }),
        tap((response) => this.handleLoginResponse(response, this.challenge?.remember ?? true)),
      );
  }

  /** Re-sends the OTP for the outstanding challenge. */
  resendOtp(): Observable<{ challengeId: string; target: string }> {
    if (!environment.useMockData) {
      return this.http.post<{ challengeId: string; target: string }>(
        `${environment.apiBaseUrl}/auth/resend-otp`,
        { challengeId: this.challenge?.challengeId },
      );
    }
    if (!this.challenge) {
      return throwError(() => new Error('There is no verification in progress.'));
    }
    const code = this.generateOtp();
    this.challenge = { ...this.challenge, code };
    this.demoOtp.set(code);
    return this.backend.respond(() => ({
      challengeId: this.challenge!.challengeId,
      target: this.maskTarget(this.challenge!.account.user.phone),
    }));
  }

  // ---------------------------------------------------------------- password

  forgotPassword(request: ForgotPasswordRequest): Observable<{ sent: boolean; target: string }> {
    if (!environment.useMockData) {
      return this.http.post<{ sent: boolean; target: string }>(
        `${environment.apiBaseUrl}/auth/forgot-password`,
        request,
      );
    }
    const account = this.findAccount(request.identifier);
    // Never disclose whether an account exists — always report success.
    return this.backend.respond(() => ({
      sent: true,
      target:
        request.channel === 'SMS'
          ? this.maskTarget(account?.user.phone ?? '+856 20 •••• ••••')
          : this.maskTarget(account?.user.email ?? 'user@laolottery.la'),
    }));
  }

  resetPassword(request: ResetPasswordRequest): Observable<{ success: boolean }> {
    if (!environment.useMockData) {
      return this.http.post<{ success: boolean }>(`${environment.apiBaseUrl}/auth/reset-password`, request);
    }
    return this.backend.respond(() => ({ success: true }));
  }

  changePassword(request: ChangePasswordRequest): Observable<{ success: boolean }> {
    if (!environment.useMockData) {
      return this.http.post<{ success: boolean }>(`${environment.apiBaseUrl}/auth/change-password`, request);
    }
    return this.backend.respond(() => {
      this.currentUser.update((user) => (user ? { ...user, mustChangePassword: false } : user));
      this.persistUser();
      return { success: true };
    });
  }

  // ---------------------------------------------------------------- session

  /** Silent token renewal, invoked by the session service and the interceptor. */
  refreshToken(): Observable<AuthTokens> {
    if (!environment.useMockData) {
      return this.http
        .post<AuthTokens>(`${environment.apiBaseUrl}/auth/refresh`, {
          refreshToken: this.tokens.refreshToken,
        })
        .pipe(tap((tokens) => this.tokens.store(tokens, true)));
    }

    const user = this.currentUser();
    if (!user) {
      return throwError(() => new Error('No active session to refresh.'));
    }
    return this.backend
      .respond(() => this.issueTokens(user), { latencyMs: 120 })
      .pipe(tap((tokens) => this.tokens.store(tokens, true)));
  }

  logout(reason?: 'manual' | 'expired' | 'idle' | 'unauthorised'): void {
    this.logger.info(`Signing out (${reason ?? 'manual'})`);
    this.currentUser.set(null);
    this.challenge = null;
    this.demoOtp.set('');
    this.tokens.clear();
    this.storage.remove(STORAGE_KEYS.currentUser);
    void this.router.navigate(['/auth/login'], {
      queryParams: reason && reason !== 'manual' ? { reason } : undefined,
    });
  }

  /** Records where an unauthenticated visitor was heading. */
  setRedirectUrl(url: string): void {
    if (url && !url.startsWith('/auth')) {
      this.redirectUrl = url;
    }
  }

  consumeRedirectUrl(): string {
    const url = this.redirectUrl;
    this.redirectUrl = '/dashboard';
    return url;
  }

  /** Applies profile edits to the in-memory session user. */
  patchUser(changes: Partial<AuthenticatedUser>): void {
    this.currentUser.update((user) => (user ? { ...user, ...changes } : user));
    this.persistUser();
  }

  // ---------------------------------------------------------------- internals

  private handleLoginResponse(response: LoginResponse, remember: boolean): void {
    if (response.result !== LoginResult.Success || !response.tokens || !response.user) {
      return;
    }
    this.tokens.store(response.tokens, remember);
    this.currentUser.set(response.user);
    this.persistUser();
    this.challenge = null;
    this.demoOtp.set('');

    if (remember) {
      this.storage.set(STORAGE_KEYS.rememberedUser, response.user.username);
      this.rememberedUsername.set(response.user.username);
    } else {
      this.storage.remove(STORAGE_KEYS.rememberedUser);
      this.rememberedUsername.set('');
    }
  }

  private persistUser(): void {
    const user = this.currentUser();
    if (user) {
      this.storage.set(STORAGE_KEYS.currentUser, user);
    }
  }

  private issueTokens(user: AuthenticatedUser): AuthTokens {
    const ttlSeconds = environment.session.sessionTimeoutSeconds;
    return {
      accessToken: TokenService.issueMockToken(user.id, user.roles as string[], ttlSeconds),
      refreshToken: TokenService.issueMockToken(user.id, ['refresh'], ttlSeconds * 24),
      tokenType: 'Bearer',
      expiresAt: Date.now() + ttlSeconds * 1000,
      refreshExpiresAt: Date.now() + ttlSeconds * 24 * 1000,
    };
  }

  private findAccount(identifier: string): DemoAccount | undefined {
    const needle = identifier.trim().toLowerCase();
    return DEMO_ACCOUNTS.find(
      (candidate) =>
        candidate.username.toLowerCase() === needle || candidate.user.email.toLowerCase() === needle,
    );
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private maskTarget(value: string): string {
    if (value.includes('@')) {
      const [name, domain] = value.split('@');
      return `${name?.slice(0, 2)}•••@${domain}`;
    }
    return value.replace(/\d(?=\d{3})/g, '•');
  }

  private mockLogin(request: LoginRequest): LoginResponse {
    const account = this.findAccount(request.username);

    if (!account || account.password !== request.password) {
      return { result: LoginResult.InvalidCredentials, message: 'Invalid username or password.' };
    }

    if (account.requiresOtp) {
      const code = this.generateOtp();
      this.challenge = {
        challengeId: `chg-${Date.now().toString(36)}`,
        account,
        remember: request.rememberMe,
        code,
      };
      // Surfaced on the OTP screen because there is no SMS gateway in mock mode.
      this.demoOtp.set(code);
      return {
        result: LoginResult.MfaRequired,
        challengeId: this.challenge.challengeId,
        challengeTarget: this.maskTarget(account.user.phone),
        message: 'A verification code has been sent to your registered mobile number.',
      };
    }

    return {
      result: LoginResult.Success,
      tokens: this.issueTokens(account.user),
      user: { ...account.user, lastLoginAt: new Date().toISOString() },
    };
  }

  private mockVerifyOtp(request: OtpVerifyRequest): LoginResponse {
    if (!this.challenge || this.challenge.challengeId !== request.challengeId) {
      return { result: LoginResult.InvalidCredentials, message: 'This verification session has expired.' };
    }
    if (request.code !== this.challenge.code) {
      return { result: LoginResult.InvalidCredentials, message: 'The verification code is incorrect.' };
    }
    const { account } = this.challenge;
    return {
      result: LoginResult.Success,
      tokens: this.issueTokens(account.user),
      user: { ...account.user, lastLoginAt: new Date().toISOString() },
    };
  }
}
