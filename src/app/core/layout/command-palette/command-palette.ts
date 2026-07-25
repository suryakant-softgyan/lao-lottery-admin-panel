import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, switchMap } from 'rxjs';

import { KEYBOARD_SHORTCUTS } from '@core/constants/app.constants';
import type { CommandItem, GlobalSearchResult } from '@core/models/navigation.model';
import { GlobalSearchService } from '@core/services/global-search.service';
import { LayoutService } from '@core/services/layout.service';
import { NavigationService } from '@core/services/navigation.service';
import { ThemeService } from '@core/services/theme.service';
import { Avatar } from '@shared/components/avatar/avatar';
import { AutofocusDirective } from '@shared/directives/ui.directives';

const TYPE_LABEL: Record<string, string> = {
  page: 'Pages',
  user: 'Users',
  agent: 'Agents',
  retailer: 'Retailers',
  ticket: 'Tickets',
  draw: 'Draws',
  transaction: 'Transactions',
};

/**
 * Ctrl/⌘+K command palette.
 *
 * Combines navigation, quick actions (theme, density, layout) and universal
 * search into one keyboard-first surface — the fastest route to any record or
 * screen in the portal.
 */
@Component({
  selector: 'll-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Avatar, AutofocusDirective],
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.scss',
})
export class CommandPalette {
  private readonly layout = inject(LayoutService);
  private readonly navigation = inject(NavigationService);
  private readonly search = inject(GlobalSearchService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly shortcuts = KEYBOARD_SHORTCUTS;
  protected readonly term = signal('');
  protected readonly activeIndex = signal(0);
  protected readonly showShortcuts = signal(false);

  private readonly termChanges = new Subject<string>();

  /** Remote/dataset results, debounced so typing stays responsive. */
  private readonly searchResults = toSignal(
    this.termChanges.pipe(
      debounceTime(180),
      switchMap((value) => this.search.search(value)),
    ),
    { initialValue: [] as GlobalSearchResult[] },
  );

  /** Static commands that are always available. */
  private readonly staticCommands = computed<CommandItem[]>(() => [
    {
      id: 'cmd-theme-toggle',
      label: this.theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode',
      description: 'Change the appearance mode',
      icon: this.theme.isDark() ? 'light_mode' : 'dark_mode',
      category: 'theme',
      keywords: ['theme', 'dark', 'light', 'appearance', 'mode'],
      shortcut: 'Ctrl+Shift+D',
      run: () => this.theme.toggleDarkMode(),
    },
    {
      id: 'cmd-appearance',
      label: 'Open appearance settings',
      description: 'Presets, colours, density and layout',
      icon: 'palette',
      category: 'setting',
      keywords: ['theme', 'colour', 'color', 'preset', 'density', 'font'],
      route: '/settings/appearance',
    },
    {
      id: 'cmd-branding',
      label: 'Open branding & white label',
      description: 'Logos, imagery and regional formats',
      icon: 'branding_watermark',
      category: 'setting',
      keywords: ['brand', 'logo', 'white label', 'tenant'],
      route: '/settings/branding',
    },
    {
      id: 'cmd-density',
      label: 'Cycle interface density',
      description: 'Comfortable → Compact → Ultra compact',
      icon: 'density_medium',
      category: 'action',
      keywords: ['density', 'compact', 'spacing', 'comfortable'],
      run: () => this.cycleDensity(),
    },
    {
      id: 'cmd-sidebar',
      label: 'Toggle the sidebar',
      description: 'Collapse or expand the navigation rail',
      icon: 'menu_open',
      category: 'action',
      keywords: ['sidebar', 'menu', 'navigation', 'collapse'],
      shortcut: 'Ctrl+B',
      run: () => this.layout.toggleSidebar(),
    },
    {
      id: 'cmd-fullscreen',
      label: 'Toggle fullscreen',
      icon: 'fullscreen',
      category: 'action',
      keywords: ['fullscreen', 'presentation', 'kiosk'],
      shortcut: 'Ctrl+Shift+F',
      run: () => void this.layout.toggleFullscreen(),
    },
    {
      id: 'cmd-print',
      label: 'Print the current page',
      icon: 'print',
      category: 'action',
      keywords: ['print', 'pdf', 'paper'],
      shortcut: 'Ctrl+P',
      run: () => this.layout.print(),
    },
    {
      id: 'cmd-shortcuts',
      label: 'Show keyboard shortcuts',
      icon: 'keyboard',
      category: 'help',
      keywords: ['keyboard', 'shortcut', 'hotkey', 'help'],
      shortcut: '?',
      run: () => this.showShortcuts.set(true),
    },
  ]);

  /** Commands filtered by the current term. */
  protected readonly commands = computed(() => {
    const needle = this.term().trim().toLowerCase();
    const all = this.staticCommands();
    if (!needle) {
      return all.slice(0, 6);
    }
    return all.filter((command) =>
      [command.label, command.description ?? '', ...command.keywords]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  });

  /** Recent pages, shown when the palette opens with an empty query. */
  protected readonly recent = computed(() =>
    this.term().trim() ? [] : this.navigation.recentPages().slice(0, 5),
  );

  /** Search hits grouped by entity type for a scannable result list. */
  protected readonly groups = computed(() => {
    const grouped = new Map<string, GlobalSearchResult[]>();
    for (const result of this.searchResults()) {
      const bucket = grouped.get(result.type) ?? [];
      bucket.push(result);
      grouped.set(result.type, bucket);
    }
    return [...grouped.entries()].map(([type, items]) => ({
      type,
      label: TYPE_LABEL[type] ?? type,
      items,
    }));
  });

  /** Flat list used for keyboard navigation across every section. */
  protected readonly flatItems = computed<{ kind: 'command' | 'result'; id: string; run: () => void }[]>(
    () => {
      const items: { kind: 'command' | 'result'; id: string; run: () => void }[] = [];
      for (const command of this.commands()) {
        items.push({ kind: 'command', id: command.id, run: () => this.runCommand(command) });
      }
      for (const group of this.groups()) {
        for (const result of group.items) {
          items.push({ kind: 'result', id: result.id, run: () => this.openResult(result) });
        }
      }
      return items;
    },
  );

  protected readonly isEmpty = computed(
    () => this.term().trim().length >= 2 && this.flatItems().length === 0,
  );

  constructor() {
    // Reset the palette each time it opens.
    effect(() => {
      if (this.layout.isCommandPaletteOpen()) {
        this.term.set('');
        this.activeIndex.set(0);
        this.showShortcuts.set(false);
        this.termChanges.next('');
      }
    });
  }

  protected onTermChange(value: string): void {
    this.term.set(value);
    this.activeIndex.set(0);
    this.termChanges.next(value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.flatItems();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update((index) => (items.length === 0 ? 0 : (index + 1) % items.length));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update((index) =>
          items.length === 0 ? 0 : (index - 1 + items.length) % items.length,
        );
        break;
      case 'Enter': {
        event.preventDefault();
        items[this.activeIndex()]?.run();
        break;
      }
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      default:
        break;
    }
  }

  protected isActive(id: string): boolean {
    return this.flatItems()[this.activeIndex()]?.id === id;
  }

  protected runCommand(command: CommandItem): void {
    if (command.run) {
      command.run();
      if (command.id !== 'cmd-shortcuts') {
        this.close();
      }
      return;
    }
    if (command.route) {
      void this.router.navigateByUrl(command.route);
      this.close();
    }
  }

  protected openResult(result: GlobalSearchResult): void {
    void this.router.navigateByUrl(result.route);
    this.close();
  }

  protected openRecent(route: string): void {
    void this.router.navigateByUrl(route);
    this.close();
  }

  protected close(): void {
    this.layout.closeCommandPalette();
  }

  protected typeIcon(type: string): string {
    switch (type) {
      case 'user':
        return 'person';
      case 'agent':
        return 'handshake';
      case 'retailer':
        return 'storefront';
      case 'ticket':
        return 'confirmation_number';
      case 'draw':
        return 'stadia_controller';
      case 'transaction':
        return 'swap_horiz';
      default:
        return 'chevron_right';
    }
  }

  private cycleDensity(): void {
    const order = ['comfortable', 'compact', 'ultra-compact'] as const;
    const index = order.indexOf(this.theme.settings().density);
    this.theme.setDensity(order[(index + 1) % order.length]!);
  }
}
