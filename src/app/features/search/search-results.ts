import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';

import type { GlobalSearchResult, SearchEntityType } from '@core/models/navigation.model';
import { GlobalSearchService } from '@core/services/global-search.service';
import { humanise } from '@core/utilities/format.util';
import { Avatar } from '@shared/components/avatar/avatar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { AutofocusDirective } from '@shared/directives/ui.directives';

const TYPE_META: Record<SearchEntityType, { label: string; icon: string }> = {
  page: { label: 'Pages', icon: 'chevron_right' },
  user: { label: 'Users', icon: 'person' },
  agent: { label: 'Agents', icon: 'handshake' },
  retailer: { label: 'Retailers', icon: 'storefront' },
  ticket: { label: 'Tickets', icon: 'confirmation_number' },
  draw: { label: 'Draws', icon: 'stadia_controller' },
  transaction: { label: 'Transactions', icon: 'swap_horiz' },
};

/**
 * Universal search results.
 *
 * The full-page counterpart to the command palette: the same cross-entity
 * search, grouped by type with a filter rail, for when a query returns more
 * than the palette can usefully show.
 */
@Component({
  selector: 'll-search-results',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, PageHeader, Avatar, Skeleton, StatePanel, AutofocusDirective],
  templateUrl: './search-results.html',
  styleUrl: './search-results.scss',
})
export class SearchResults {
  private readonly search = inject(GlobalSearchService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly params = toSignal(this.route.queryParams, { initialValue: {} });

  protected readonly term = signal('');
  protected readonly typeFilter = signal<SearchEntityType | ''>('');
  protected readonly loading = signal(false);
  protected readonly results = signal<GlobalSearchResult[]>([]);

  protected readonly filtered = computed(() => {
    const type = this.typeFilter();
    return type ? this.results().filter((result) => result.type === type) : this.results();
  });

  protected readonly groups = computed(() => {
    const grouped = new Map<SearchEntityType, GlobalSearchResult[]>();
    for (const result of this.filtered()) {
      const bucket = grouped.get(result.type) ?? [];
      bucket.push(result);
      grouped.set(result.type, bucket);
    }
    return [...grouped.entries()].map(([type, items]) => ({
      type,
      label: TYPE_META[type].label,
      icon: TYPE_META[type].icon,
      items,
    }));
  });

  /** Filter chips with per-type counts. */
  protected readonly typeCounts = computed(() => {
    const counts = new Map<SearchEntityType, number>();
    for (const result of this.results()) {
      counts.set(result.type, (counts.get(result.type) ?? 0) + 1);
    }
    return [...counts.entries()].map(([type, count]) => ({
      type,
      count,
      label: TYPE_META[type].label,
      icon: TYPE_META[type].icon,
    }));
  });

  constructor() {
    // Keep the query in step with the URL so a search is shareable.
    effect(() => {
      const query = (this.params() as Record<string, string>)['q'] ?? '';
      if (query !== this.term()) {
        this.term.set(query);
        this.run(query);
      }
    });
  }

  protected run(term: string): void {
    if (term.trim().length < 2) {
      this.results.set([]);
      return;
    }

    this.loading.set(true);
    this.search.search(term).subscribe({
      next: (results) => {
        this.results.set(results);
        this.loading.set(false);
      },
      error: () => {
        this.results.set([]);
        this.loading.set(false);
      },
    });
  }

  protected submit(): void {
    void this.router.navigate(['/search'], { queryParams: { q: this.term().trim() } });
    this.run(this.term());
  }

  protected typeIcon(type: SearchEntityType): string {
    return TYPE_META[type].icon;
  }

  protected humanise(value: string): string {
    return humanise(value);
  }

  protected open(result: GlobalSearchResult): void {
    void this.router.navigateByUrl(result.route);
  }
}
