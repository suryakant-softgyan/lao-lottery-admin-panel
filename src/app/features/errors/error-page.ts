import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from '@core/authentication/auth.service';

interface ErrorPreset {
  title: string;
  message: string;
  icon: string;
  tone: string;
}

const PRESETS: Record<number, ErrorPreset> = {
  403: {
    title: 'Access denied',
    message:
      'Your role does not include permission for this area. If you believe this is wrong, ask an administrator to review your role assignment.',
    icon: 'lock',
    tone: 'warning',
  },
  404: {
    title: 'Page not found',
    message: 'The page you are looking for has been moved, renamed, or never existed.',
    icon: 'travel_explore',
    tone: 'info',
  },
  500: {
    title: 'Something went wrong',
    message:
      'An unexpected error occurred while processing your request. The technical team has been notified.',
    icon: 'error',
    tone: 'danger',
  },
  503: {
    title: 'Scheduled maintenance',
    message:
      'The portal is temporarily unavailable while maintenance is carried out. Please try again shortly.',
    icon: 'engineering',
    tone: 'warning',
  },
};

/** Shared error screen for 403 / 404 / 500 / 503 and the wildcard route. */
@Component({
  selector: 'll-error-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule],
  template: `
    <div class="error" [style.--tone]="'var(--ll-' + preset().tone + ')'">
      <div class="error__code">{{ code() }}</div>
      <div class="error__icon">
        <span class="material-symbols-rounded" aria-hidden="true">{{ preset().icon }}</span>
      </div>
      <h1 class="error__title">{{ preset().title }}</h1>
      <p class="error__message">{{ preset().message }}</p>

      <div class="error__actions">
        <button mat-flat-button type="button" [routerLink]="homeRoute()">
          <span class="material-symbols-rounded" aria-hidden="true">home</span>
          {{ isAuthenticated() ? 'Back to dashboard' : 'Go to sign in' }}
        </button>
        <button mat-stroked-button type="button" (click)="goBack()">
          <span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
          Go back
        </button>
      </div>

      <p class="error__hint">
        Need help? Contact the service desk quoting reference
        <code>{{ reference }}</code>
      </p>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .error {
      position: relative;
      display: grid;
      justify-items: center;
      gap: 8px;
      padding: 72px 24px;
      text-align: center;

      &__code {
        position: absolute;
        top: 24px;
        font-size: 11rem;
        font-weight: 850;
        line-height: 1;
        letter-spacing: -0.06em;
        color: color-mix(in srgb, var(--tone) 10%, transparent);
        user-select: none;
        pointer-events: none;
      }

      &__icon {
        position: relative;
        display: grid;
        place-items: center;
        width: 84px;
        height: 84px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--tone) 13%, transparent);
        color: var(--tone);
        margin-bottom: 6px;

        .material-symbols-rounded {
          font-size: 40px;
          width: 40px;
          height: 40px;
        }
      }

      &__title {
        position: relative;
        margin: 0;
        font-size: 1.6rem;
        font-weight: 730;
        letter-spacing: -0.03em;
      }

      &__message {
        position: relative;
        margin: 0;
        max-width: 520px;
        color: var(--ll-text-muted);
        line-height: 1.65;
        font-size: 0.9rem;
      }

      &__actions {
        position: relative;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
        margin-top: 14px;

        .material-symbols-rounded {
          font-size: 18px;
          width: 18px;
          height: 18px;
          margin-inline-end: 6px;
        }
      }

      &__hint {
        position: relative;
        margin-top: 22px;
        font-size: 0.76rem;
        color: var(--ll-text-muted);

        code {
          padding: 2px 8px;
          border-radius: 5px;
          background: var(--ll-surface-hover);
          font-family: ui-monospace, monospace;
        }
      }
    }
  `,
})
export class ErrorPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private readonly routeData = toSignal(this.route.data, { initialValue: {} as Record<string, unknown> });

  protected readonly code = computed(() => Number(this.routeData()['code'] ?? 404));

  protected readonly preset = computed(() => PRESETS[this.code()] ?? PRESETS[404]!);

  protected readonly isAuthenticated = computed(() => this.auth.isAuthenticated());

  protected readonly homeRoute = computed(() => (this.isAuthenticated() ? '/dashboard' : '/auth/login'));

  /** Stable per-visit reference an operator can quote to the service desk. */
  protected readonly reference = `ERR-${Date.now().toString(36).toUpperCase()}`;

  protected goBack(): void {
    if (history.length > 1) {
      history.back();
    } else {
      void this.router.navigateByUrl(this.homeRoute());
    }
  }
}
