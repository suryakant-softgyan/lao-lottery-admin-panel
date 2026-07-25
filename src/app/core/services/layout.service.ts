import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { STORAGE_KEYS } from '../constants/app.constants';
import { StorageService } from './storage.service';
import { ThemeService } from './theme.service';

/** Screen-size buckets the shell reacts to. */
export type ScreenSize = 'mobile' | 'tablet' | 'desktop' | 'wide';

interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
}

/**
 * Runtime shell state: sidebar, quick panel, fullscreen and responsiveness.
 *
 * Persistent *preferences* (sidebar mode, header style, content width) live in
 * {@link ThemeService}; this service owns the transient state that depends on
 * the current viewport and user interaction.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);
  private readonly theme = inject(ThemeService);
  private readonly breakpoints = inject(BreakpointObserver);

  private readonly sidebarState = signal<SidebarState>({
    collapsed: this.storage.get<SidebarState>(STORAGE_KEYS.sidebarState, {
      collapsed: false,
      mobileOpen: false,
    }).collapsed,
    mobileOpen: false,
  });

  private readonly quickPanelOpen = signal(false);
  private readonly fullscreen = signal(false);
  private readonly searchOpen = signal(false);
  private readonly commandPaletteOpen = signal(false);

  /** Reactive viewport bucket, derived from the CDK breakpoint observer. */
  readonly screenSize = toSignal(
    this.breakpoints
      .observe([
        Breakpoints.XSmall,
        Breakpoints.Small,
        Breakpoints.Medium,
        Breakpoints.Large,
        Breakpoints.XLarge,
      ])
      .pipe(
        map((): ScreenSize => {
          if (this.breakpoints.isMatched(Breakpoints.XSmall)) {
            return 'mobile';
          }
          if (this.breakpoints.isMatched(Breakpoints.Small)) {
            return 'tablet';
          }
          if (this.breakpoints.isMatched(Breakpoints.XLarge)) {
            return 'wide';
          }
          return 'desktop';
        }),
      ),
    { initialValue: 'desktop' as ScreenSize },
  );

  readonly isMobile = computed(() => this.screenSize() === 'mobile');
  readonly isTablet = computed(() => this.screenSize() === 'tablet');
  readonly isHandset = computed(() => this.isMobile() || this.isTablet());
  readonly isWide = computed(() => this.screenSize() === 'wide');

  readonly sidebarCollapsed = computed(() => {
    // Mini/collapsed layout modes force the rail regardless of user toggling.
    const mode = this.theme.settings().layout.sidebar;
    if (mode === 'mini' || mode === 'collapsed') {
      return true;
    }
    return this.sidebarState().collapsed;
  });

  readonly sidebarMobileOpen = computed(() => this.sidebarState().mobileOpen);

  /** True when the sidebar renders as an overlay drawer rather than inline. */
  readonly sidebarIsOverlay = computed(() => {
    const mode = this.theme.settings().layout.sidebar;
    return this.isHandset() || mode === 'overlay' || mode === 'floating';
  });

  /** Top navigation replaces the sidebar entirely in `top` mode. */
  readonly showSidebar = computed(() => this.theme.settings().layout.navigation !== 'top');

  readonly showTopNav = computed(() => {
    const mode = this.theme.settings().layout.navigation;
    return (mode === 'top' || mode === 'mixed') && !this.isHandset();
  });

  readonly isQuickPanelOpen = this.quickPanelOpen.asReadonly();
  readonly isFullscreen = this.fullscreen.asReadonly();
  readonly isSearchOpen = this.searchOpen.asReadonly();
  readonly isCommandPaletteOpen = this.commandPaletteOpen.asReadonly();

  /** Effective sidebar width in pixels, used for the content offset. */
  readonly sidebarWidth = computed(() => {
    if (!this.showSidebar() || this.sidebarIsOverlay()) {
      return 0;
    }
    return this.sidebarCollapsed() ? 76 : 268;
  });

  toggleSidebar(): void {
    if (this.sidebarIsOverlay()) {
      this.sidebarState.update((state) => ({ ...state, mobileOpen: !state.mobileOpen }));
      return;
    }
    this.sidebarState.update((state) => ({ ...state, collapsed: !state.collapsed }));
    this.persistSidebar();
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.sidebarState.update((state) => ({ ...state, collapsed }));
    this.persistSidebar();
  }

  closeMobileSidebar(): void {
    this.sidebarState.update((state) => ({ ...state, mobileOpen: false }));
  }

  toggleQuickPanel(): void {
    this.quickPanelOpen.update((open) => !open);
  }

  closeQuickPanel(): void {
    this.quickPanelOpen.set(false);
  }

  openSearch(): void {
    this.searchOpen.set(true);
  }

  closeSearch(): void {
    this.searchOpen.set(false);
  }

  openCommandPalette(): void {
    this.commandPaletteOpen.set(true);
  }

  closeCommandPalette(): void {
    this.commandPaletteOpen.set(false);
  }

  toggleCommandPalette(): void {
    this.commandPaletteOpen.update((open) => !open);
  }

  /** Requests browser fullscreen; silently no-ops when the API is blocked. */
  async toggleFullscreen(): Promise<void> {
    const element = this.document.documentElement;
    try {
      if (!this.document.fullscreenElement) {
        await element.requestFullscreen?.();
        this.fullscreen.set(true);
      } else {
        await this.document.exitFullscreen?.();
        this.fullscreen.set(false);
      }
    } catch {
      // Fullscreen can be refused by policy — keep the flag truthful.
      this.fullscreen.set(Boolean(this.document.fullscreenElement));
    }
  }

  /** Opens the browser print dialog for the current view. */
  print(): void {
    this.document.defaultView?.print();
  }

  private persistSidebar(): void {
    this.storage.set(STORAGE_KEYS.sidebarState, this.sidebarState());
  }
}
