import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';

import { environment } from '@env/environment';

import { PLACEHOLDER } from '../constants/app.constants';
import { mockDataset } from '../mock/dataset';
import type { GlobalSearchResult, SearchEntityType } from '../models/navigation.model';
import { formatCurrency } from '../utilities/format.util';
import { MockBackendService } from './mock-backend.service';
import { NavigationService } from './navigation.service';

const MAX_PER_TYPE = 5;

/**
 * Universal search across users, agents, retailers, tickets, draws,
 * transactions and pages.
 *
 * Scoring is deliberately simple and predictable: an exact match outranks a
 * prefix match, which outranks a substring match. When the search endpoint
 * exists, replace {@link search} with a single call — the result contract that
 * the UI renders stays the same.
 */
@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
  private readonly backend = inject(MockBackendService);
  private readonly navigation = inject(NavigationService);
  private readonly http = inject(HttpClient);

  search(term: string, types?: readonly SearchEntityType[]): Observable<GlobalSearchResult[]> {
    if (!environment.useMockData) {
      return this.liveSearch(term, types);
    }
    return this.backend.respond(() => this.runSearch(term, types), { latencyMs: 220 });
  }

  private score(haystack: string, needle: string): number {
    const value = haystack.toLowerCase();
    const query = needle.toLowerCase();
    if (!value.includes(query)) {
      return 0;
    }
    if (value === query) {
      return 100;
    }
    if (value.startsWith(query)) {
      return 80;
    }
    // Word-boundary matches beat mid-token matches.
    return value.includes(` ${query}`) ? 60 : 40;
  }

  private runSearch(term: string, types?: readonly SearchEntityType[]): GlobalSearchResult[] {
    const needle = term.trim();
    if (needle.length < 2) {
      return [];
    }

    const wanted = (type: SearchEntityType): boolean => !types?.length || types.includes(type);
    const results: GlobalSearchResult[] = [];

    if (wanted('page')) {
      for (const item of this.navigation.routableItems()) {
        const score = Math.max(
          this.score(item.label, needle),
          ...(item.keywords ?? []).map((keyword) => this.score(keyword, needle) * 0.8),
        );
        if (score > 0) {
          results.push({
            id: item.id,
            type: 'page',
            title: item.label,
            subtitle: 'Navigate to page',
            icon: item.icon ?? 'chevron_right',
            route: item.route!,
            score: score + 5,
          });
        }
      }
    }

    if (wanted('user')) {
      for (const user of mockDataset.users) {
        const score = Math.max(
          this.score(user.fullName, needle),
          this.score(user.username, needle),
          this.score(user.email, needle),
          this.score(user.phone, needle),
          this.score(user.code, needle),
        );
        if (score > 0) {
          results.push({
            id: user.id,
            type: 'user',
            title: user.fullName,
            subtitle: `${user.code} · ${user.email}`,
            meta: String(user.primaryRole),
            icon: 'person',
            avatarUrl: user.avatarUrl,
            route: `/users/details/${user.id}`,
            score,
          });
        }
      }
    }

    if (wanted('agent')) {
      for (const agent of mockDataset.agents) {
        const score = Math.max(
          this.score(agent.name, needle),
          this.score(agent.code, needle),
          this.score(agent.businessName, needle),
          this.score(agent.contact.phone, needle),
        );
        if (score > 0) {
          results.push({
            id: agent.id,
            type: 'agent',
            title: agent.name,
            subtitle: `${agent.code} · ${agent.province}`,
            meta: agent.tier,
            icon: 'handshake',
            avatarUrl: agent.avatarUrl,
            route: `/agents/details/${agent.id}`,
            score,
          });
        }
      }
    }

    if (wanted('retailer')) {
      for (const retailer of mockDataset.retailers) {
        const score = Math.max(
          this.score(retailer.shopName, needle),
          this.score(retailer.code, needle),
          this.score(retailer.ownerName, needle),
        );
        if (score > 0) {
          results.push({
            id: retailer.id,
            type: 'retailer',
            title: retailer.shopName,
            subtitle: `${retailer.code} · ${retailer.district}, ${retailer.province}`,
            meta: retailer.status,
            icon: 'storefront',
            avatarUrl: PLACEHOLDER.avatar(retailer.shopName),
            route: `/retailers/details/${retailer.id}`,
            score,
          });
        }
      }
    }

    if (wanted('ticket')) {
      for (const ticket of mockDataset.tickets) {
        const score = Math.max(
          this.score(ticket.ticketNumber, needle),
          this.score(ticket.serialNumber, needle),
          this.score(ticket.barcode, needle),
          this.score(ticket.customerName, needle),
          this.score(ticket.customerPhone, needle),
        );
        if (score > 0) {
          results.push({
            id: ticket.id,
            type: 'ticket',
            title: ticket.ticketNumber,
            subtitle: `${ticket.lotteryName} · ${ticket.customerName}`,
            meta: formatCurrency(ticket.totalStake),
            icon: 'confirmation_number',
            route: `/tickets/details/${ticket.id}`,
            score,
          });
        }
      }
    }

    if (wanted('draw')) {
      for (const draw of mockDataset.draws) {
        const score = Math.max(this.score(draw.code, needle), this.score(draw.lotteryName, needle));
        if (score > 0) {
          results.push({
            id: draw.id,
            type: 'draw',
            title: draw.code,
            subtitle: `${draw.lotteryName} · draw #${draw.drawNumber}`,
            meta: draw.status,
            icon: 'stadia_controller',
            route: `/draws/details/${draw.id}`,
            score,
          });
        }
      }
    }

    if (wanted('transaction')) {
      for (const transaction of mockDataset.walletTransactions) {
        const score = Math.max(
          this.score(transaction.reference, needle),
          this.score(transaction.ownerName, needle),
        );
        if (score > 0) {
          results.push({
            id: transaction.id,
            type: 'transaction',
            title: transaction.reference,
            subtitle: `${transaction.ownerName} · ${transaction.type}`,
            meta: formatCurrency(transaction.amount),
            icon: 'swap_horiz',
            route: `/wallet/transactions?reference=${transaction.reference}`,
            score,
          });
        }
      }
    }

    // Cap each type so one entity cannot crowd out the rest.
    const byType = new Map<SearchEntityType, GlobalSearchResult[]>();
    for (const result of results.sort((a, b) => b.score - a.score)) {
      const bucket = byType.get(result.type) ?? [];
      if (bucket.length < MAX_PER_TYPE) {
        bucket.push(result);
        byType.set(result.type, bucket);
      }
    }

    return [...byType.values()].flat().sort((a, b) => b.score - a.score);
  }
  // =====================================================================================
  // Live API: records come from `/admin/search` (permission aware); pages are matched locally
  // =====================================================================================

  private liveSearch(term: string, types?: readonly SearchEntityType[]): Observable<GlobalSearchResult[]> {
    const needle = term.trim();
    if (needle.length < 2) {
      return of([]);
    }
    const pages = this.runSearch(needle, ['page']);
    const wanted = (type: SearchEntityType): boolean => !types?.length || types.includes(type);
    const kinds: Record<string, { type: SearchEntityType; icon: string; route: (id: string) => string }> = {
      USER: { type: 'user', icon: 'person', route: (id) => `/users/details/${id}` },
      AGENT: { type: 'agent', icon: 'support_agent', route: (id) => `/agents/details/${id}` },
      RETAILER: { type: 'retailer', icon: 'store', route: (id) => `/retailers/details/${id}` },
      TICKET: { type: 'ticket', icon: 'confirmation_number', route: (id) => `/tickets/details/${id}` },
      WALLET_TRANSACTION: { type: 'transaction', icon: 'swap_horiz', route: () => '/wallet/transactions' },
      PAYMENT: { type: 'transaction', icon: 'payments', route: () => '/payment' },
    };
    return this.http
      .get<{ type: string; id: string; title: string; subtitle: string; status: string }[]>(
        `${environment.apiBaseUrl}/admin/search`,
        { params: { q: needle, perType: String(MAX_PER_TYPE) }, headers: { 'X-Quiet': '1' } },
      )
      .pipe(
        catchError(() => of([])),
        map((hits) => {
          const records = hits.flatMap((hit) => {
            const kind = kinds[hit.type];
            if (!kind || !wanted(kind.type)) {
              return [];
            }
            return [
              {
                id: hit.id,
                type: kind.type,
                title: hit.title,
                subtitle: hit.subtitle,
                meta: hit.status,
                icon: kind.icon,
                avatarUrl: kind.type === 'user' ? PLACEHOLDER.avatar(hit.title) : undefined,
                route: kind.route(hit.id),
                score: this.score(hit.title, needle) || 30,
              } satisfies GlobalSearchResult,
            ];
          });
          return [...(wanted('page') ? pages : []), ...records].sort((a, b) => b.score - a.score);
        }),
      );
  }
}
