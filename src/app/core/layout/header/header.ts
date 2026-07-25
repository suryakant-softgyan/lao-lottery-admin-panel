import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '@core/authentication/auth.service';
import { LANGUAGES } from '@core/constants/app.constants';
import { ROLE_MAP } from '@core/constants/status-maps.constants';
import { Severity } from '@core/enums';
import { LayoutService } from '@core/services/layout.service';
import { NotificationCentreService } from '@core/services/notification-centre.service';
import { ThemeService } from '@core/services/theme.service';
import { TranslationService } from '@core/services/translation.service';
import { Avatar } from '@shared/components/avatar/avatar';
import { RelativePipe } from '@shared/pipes/format.pipes';

/**
 * Application header.
 *
 * Hosts the sidebar toggle, universal search, the notification and message
 * centres, language and theme switches, fullscreen, refresh, help and the
 * profile menu — the controls the specification asks to be present on every
 * screen.
 */
@Component({
  selector: 'll-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatDividerModule,
    MatMenuModule,
    MatTooltipModule,
    Avatar,
    RelativePipe,
  ],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  protected readonly auth = inject(AuthService);
  protected readonly layout = inject(LayoutService);
  protected readonly theme = inject(ThemeService);
  protected readonly notifications = inject(NotificationCentreService);
  protected readonly translation = inject(TranslationService);
  private readonly router = inject(Router);

  protected readonly languages = LANGUAGES;
  protected readonly roleMap = ROLE_MAP;

  protected readonly searchTerm = signal('');

  protected readonly user = computed(() => this.auth.user());

  protected readonly roleLabel = computed(() => {
    const role = String(this.user()?.primaryRole ?? '');
    return ROLE_MAP[role]?.label ?? role;
  });

  protected readonly modeIcon = computed(() => {
    switch (this.theme.settings().mode) {
      case 'dark':
        return 'dark_mode';
      case 'light':
        return 'light_mode';
      default:
        return 'brightness_auto';
    }
  });

  protected readonly currentLanguage = computed(() =>
    this.languages.find((language) => language.value === this.translation.current()),
  );

  protected readonly unread = computed(() => this.notifications.unreadCount());

  protected readonly recentNotifications = computed(() => this.notifications.recent().slice(0, 5));

  /** Cycles light → dark → auto so one control covers all three modes. */
  protected cycleMode(): void {
    const order = ['light', 'dark', 'auto'] as const;
    const index = order.indexOf(this.theme.settings().mode);
    this.theme.setMode(order[(index + 1) % order.length]!);
  }

  protected onSearchSubmit(event: Event): void {
    event.preventDefault();
    const term = this.searchTerm().trim();
    if (term) {
      void this.router.navigate(['/search'], { queryParams: { q: term } });
    }
  }

  protected openCommandPalette(): void {
    this.layout.openCommandPalette();
  }

  protected refreshPage(): void {
    // Re-navigating the current URL replays resolvers and page loads.
    const url = this.router.url;
    void this.router
      .navigateByUrl('/', { skipLocationChange: true })
      .then(() => this.router.navigateByUrl(url));
  }

  protected markAllRead(): void {
    this.notifications.markAllRead();
  }

  /** Maps a notification severity onto a theme tone for the icon chip. */
  protected severityTone(severity: Severity): string {
    switch (severity) {
      case Severity.Critical:
      case Severity.High:
        return 'danger';
      case Severity.Medium:
        return 'warning';
      case Severity.Low:
        return 'neutral';
      default:
        return 'info';
    }
  }

  protected signOut(): void {
    this.auth.logout('manual');
  }
}
