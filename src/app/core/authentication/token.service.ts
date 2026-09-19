import { Injectable, inject } from '@angular/core';

import { STORAGE_KEYS } from '../constants/app.constants';
import { environment } from '@env/environment';
import type { AuthTokens } from '../models/auth.model';
import { StorageService } from '../services/storage.service';

/**
 * Token custody.
 *
 * "Remember me" decides the storage medium: local storage survives a browser
 * restart, session storage does not. The JWT helpers below are deliberately
 * tolerant — the mock backend issues an unsigned token with the same shape as
 * the real one, so nothing changes when a genuine JWT arrives.
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly storage = inject(StorageService);

  /** Mirrors the persistence choice made at login. */
  private useSession = !this.storage.get<string | null>(STORAGE_KEYS.accessToken, null, false);

  get accessToken(): string | null {
    return (
      this.storage.get<string | null>(STORAGE_KEYS.accessToken, null, false) ??
      this.storage.get<string | null>(STORAGE_KEYS.accessToken, null, true)
    );
  }

  get refreshToken(): string | null {
    return (
      this.storage.get<string | null>(STORAGE_KEYS.refreshToken, null, false) ??
      this.storage.get<string | null>(STORAGE_KEYS.refreshToken, null, true)
    );
  }

  get expiresAt(): number {
    return (
      this.storage.get<number>(STORAGE_KEYS.tokenExpiry, 0, false) ||
      this.storage.get<number>(STORAGE_KEYS.tokenExpiry, 0, true)
    );
  }

  store(tokens: AuthTokens, remember: boolean): void {
    this.useSession = !remember;
    this.clear();
    this.storage.set(STORAGE_KEYS.accessToken, tokens.accessToken, this.useSession);
    this.storage.set(STORAGE_KEYS.refreshToken, tokens.refreshToken, this.useSession);
    this.storage.set(STORAGE_KEYS.tokenExpiry, tokens.expiresAt, this.useSession);
  }

  clear(): void {
    for (const key of [STORAGE_KEYS.accessToken, STORAGE_KEYS.refreshToken, STORAGE_KEYS.tokenExpiry]) {
      this.storage.remove(key, false);
      this.storage.remove(key, true);
    }
  }

  hasToken(): boolean {
    return Boolean(this.accessToken);
  }

  isExpired(): boolean {
    const expiry = this.expiresAt;
    return expiry > 0 && Date.now() >= expiry;
  }

  /** True once the token is inside the refresh window. */
  shouldRefresh(): boolean {
    const expiry = this.expiresAt;
    if (expiry <= 0) {
      return false;
    }
    return Date.now() >= expiry - environment.session.refreshSkewSeconds * 1000;
  }

  /** Milliseconds until expiry; 0 when already expired or unknown. */
  timeToExpiry(): number {
    const expiry = this.expiresAt;
    return expiry <= 0 ? 0 : Math.max(0, expiry - Date.now());
  }

  /** Decodes a JWT payload without verifying the signature (client-side only). */
  decode<T = Record<string, unknown>>(token: string | null = this.accessToken): T | null {
    if (!token) {
      return null;
    }
    const segments = token.split('.');
    if (segments.length < 2) {
      return null;
    }
    try {
      const payload = segments[1]!.replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
      return JSON.parse(decodeURIComponent(escape(atob(padded)))) as T;
    } catch {
      return null;
    }
  }

  /**
   * Builds a structurally valid, unsigned JWT for the mock backend so the rest
   * of the stack (interceptors, guards, decoding) behaves exactly as it will in
   * production.
   */
  static issueMockToken(subject: string, roles: readonly string[], ttlSeconds: number): string {
    const encode = (value: object): string =>
      btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = encode({ alg: 'none', typ: 'JWT' });
    const payload = encode({
      sub: subject,
      roles,
      iss: 'lao-lottery-mock',
      iat: issuedAt,
      exp: issuedAt + ttlSeconds,
    });
    return `${header}.${payload}.mock-signature`;
  }
}
