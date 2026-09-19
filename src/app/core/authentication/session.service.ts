import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, NgZone, computed, inject, signal } from '@angular/core';

import { environment } from '@env/environment';
import { LoggerService } from '../services/logger.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

/**
 * Events that count as "the operator is still here".
 *
 * `passive` is only applied to the scroll-blocking events, where it genuinely
 * helps the compositor. Marking `keydown` passive additionally causes Chrome to
 * refuse `preventDefault()` in the application's own keyboard-shortcut handler
 * on the same node, which breaks Ctrl+K and friends.
 */
const ACTIVITY_EVENTS: readonly { type: string; passive: boolean }[] = [
  { type: 'mousemove', passive: false },
  { type: 'mousedown', passive: false },
  { type: 'keydown', passive: false },
  { type: 'touchstart', passive: true },
  { type: 'scroll', passive: true },
  { type: 'wheel', passive: true },
];

/**
 * Idle and absolute session management.
 *
 * Two independent clocks run while a user is signed in:
 *
 *  - **Idle** — no interaction for `idleTimeoutSeconds` raises a warning with a
 *    grace countdown; ignoring it signs the user out.
 *  - **Absolute** — the access token expires regardless of activity; the
 *    service silently refreshes it inside the skew window.
 *
 * Timers run outside Angular's zone so a one-second tick does not trigger
 * application-wide change detection; signals are updated back inside the zone.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly auth = inject(AuthService);
  private readonly tokens = inject(TokenService);
  private readonly logger = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly warning = signal(false);
  private readonly countdown = signal(0);

  private lastActivity = Date.now();
  private ticker: ReturnType<typeof setInterval> | null = null;
  private listenersAttached = false;
  private refreshing = false;

  /** True while the "you are about to be signed out" prompt is showing. */
  readonly warningVisible = this.warning.asReadonly();

  /** Seconds left before automatic sign-out. */
  readonly remainingSeconds = this.countdown.asReadonly();

  readonly remainingLabel = computed(() => {
    const seconds = this.countdown();
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  });

  private readonly onActivity = (): void => {
    this.lastActivity = Date.now();
    if (this.warning()) {
      // Any interaction while the warning is up counts as "keep me signed in".
      this.zone.run(() => this.dismissWarning());
    }
  };

  /** Called once by the shell when an authenticated layout is mounted. */
  start(): void {
    if (this.ticker) {
      return;
    }
    this.lastActivity = Date.now();

    this.zone.runOutsideAngular(() => {
      if (!this.listenersAttached) {
        for (const event of ACTIVITY_EVENTS) {
          this.document.addEventListener(event.type, this.onActivity, { passive: event.passive });
        }
        this.listenersAttached = true;
      }
      this.ticker = setInterval(() => this.tick(), 1000);
    });

    this.destroyRef.onDestroy(() => this.stop());
  }

  stop(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    if (this.listenersAttached) {
      for (const event of ACTIVITY_EVENTS) {
        this.document.removeEventListener(event.type, this.onActivity);
      }
      this.listenersAttached = false;
    }
    this.warning.set(false);
    this.countdown.set(0);
  }

  /** "Stay signed in" — resets the idle clock and renews the token. */
  extend(): void {
    this.lastActivity = Date.now();
    this.dismissWarning();
    this.renewToken();
  }

  endSession(): void {
    this.stop();
    this.auth.logout('idle');
  }

  private dismissWarning(): void {
    this.warning.set(false);
    this.countdown.set(0);
  }

  private tick(): void {
    if (!this.auth.isAuthenticated()) {
      return;
    }

    const { idleTimeoutSeconds, idleGraceSeconds } = environment.session;
    const idleSeconds = Math.floor((Date.now() - this.lastActivity) / 1000);

    // Absolute expiry wins over everything else.
    if (this.tokens.isExpired()) {
      this.zone.run(() => {
        this.stop();
        this.auth.logout('expired');
      });
      return;
    }

    if (this.tokens.shouldRefresh()) {
      this.renewToken();
    }

    if (idleSeconds >= idleTimeoutSeconds + idleGraceSeconds) {
      this.zone.run(() => this.endSession());
      return;
    }

    if (idleSeconds >= idleTimeoutSeconds) {
      const remaining = idleTimeoutSeconds + idleGraceSeconds - idleSeconds;
      this.zone.run(() => {
        this.warning.set(true);
        this.countdown.set(remaining);
      });
    }
  }

  private renewToken(): void {
    if (this.refreshing) {
      return;
    }
    this.refreshing = true;
    this.zone.run(() => {
      this.auth.refreshToken().subscribe({
        next: () => {
          this.refreshing = false;
          this.logger.debug('Session: access token renewed');
        },
        error: (error: unknown) => {
          this.refreshing = false;
          this.logger.warn('Session: token renewal failed', error);
          this.auth.logout('expired');
        },
      });
    });
  }
}
