import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';

import { ThemeService } from './theme.service';

/**
 * Page-title strategy.
 *
 * Produces `Users · Lao Lottery Admin`, taking the application name from the
 * white-label branding settings so a rebranded deployment updates the browser
 * tab automatically.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly theme = inject(ThemeService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const pageTitle = this.buildTitle(snapshot);
    const appName = this.theme.branding().applicationShortName || 'Admin Portal';
    this.title.setTitle(pageTitle ? `${pageTitle} · ${appName}` : appName);
  }
}
