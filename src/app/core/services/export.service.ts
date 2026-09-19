import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

import { ExportFormat } from '../enums';
import type { TableColumn } from '../models/table.model';
import { buildCsv, escapeHtml, timestampedFileName, triggerDownload } from '../utilities/file.util';
import { getByPath } from '../utilities/object.util';
import { LoggerService } from './logger.service';
import { ThemeService } from './theme.service';
import { ToastService } from './toast.service';

export interface ExportRequest<T> {
  format: ExportFormat;
  fileName: string;
  title: string;
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  /** Optional subtitle line printed under the title (filters, date range…). */
  subtitle?: string;
  /** Adds a totals row for numeric columns. */
  includeTotals?: boolean;
}

/**
 * Client-side export pipeline.
 *
 * CSV and JSON are produced directly; Excel uses an HTML table with an
 * `application/vnd.ms-excel` MIME type (opens natively in Excel and Sheets);
 * PDF and Print both render a styled document into a hidden window and hand it
 * to the browser's print engine, which offers "Save as PDF" everywhere.
 *
 * When a reporting backend arrives, swap the body of {@link export} for a
 * request to `/reports/export` — the call sites stay unchanged.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly document = inject(DOCUMENT);
  private readonly logger = inject(LoggerService);
  private readonly toast = inject(ToastService);
  private readonly theme = inject(ThemeService);

  export<T>(request: ExportRequest<T>): void {
    const columns = request.columns.filter((column) => column.exportable !== false && !column.hidden);
    if (columns.length === 0 || request.rows.length === 0) {
      this.toast.warning('Nothing to export', 'The current view has no rows.');
      return;
    }

    try {
      switch (request.format) {
        case ExportFormat.Csv:
          this.exportCsv(request, columns);
          break;
        case ExportFormat.Excel:
          this.exportExcel(request, columns);
          break;
        case ExportFormat.Json:
          this.exportJson(request, columns);
          break;
        case ExportFormat.Pdf:
        case ExportFormat.Print:
          this.exportPrintable(request, columns, request.format === ExportFormat.Pdf);
          break;
        default:
          this.exportCsv(request, columns);
      }
    } catch (error) {
      this.logger.error('Export failed', error);
      this.toast.error('Export failed', 'The file could not be generated.');
    }
  }

  /** Resolves a cell to its display string, honouring the column formatter. */
  private cellValue<T>(row: T, column: TableColumn<T>): string {
    const raw = column.value ? column.value(row) : getByPath(row, column.key);
    if (column.format) {
      return column.format(raw, row);
    }
    if (column.badgeMap && raw !== null && raw !== undefined) {
      return column.badgeMap[String(raw)]?.label ?? String(raw);
    }
    if (raw === null || raw === undefined) {
      return '';
    }
    if (Array.isArray(raw)) {
      return raw.join(', ');
    }
    if (typeof raw === 'object') {
      return JSON.stringify(raw);
    }
    return String(raw);
  }

  private matrix<T>(
    rows: readonly T[],
    columns: readonly TableColumn<T>[],
  ): { headers: string[]; body: string[][] } {
    return {
      headers: columns.map((column) => column.label),
      body: rows.map((row) => columns.map((column) => this.cellValue(row, column))),
    };
  }

  private totalsRow<T>(rows: readonly T[], columns: readonly TableColumn<T>[]): string[] {
    return columns.map((column, index) => {
      if (index === 0) {
        return 'Total';
      }
      if (column.type !== 'number' && column.type !== 'currency') {
        return '';
      }
      const total = rows.reduce((sum, row) => {
        const raw = column.value ? column.value(row) : getByPath(row, column.key);
        const numeric = Number(raw);
        return sum + (Number.isFinite(numeric) ? numeric : 0);
      }, 0);
      return total.toLocaleString(this.theme.regional().locale);
    });
  }

  private exportCsv<T>(request: ExportRequest<T>, columns: readonly TableColumn<T>[]): void {
    const { headers, body } = this.matrix(request.rows, columns);
    const rows = request.includeTotals ? [...body, this.totalsRow(request.rows, columns)] : body;
    const csv = buildCsv(headers, rows);
    triggerDownload(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      timestampedFileName(request.fileName, 'csv'),
    );
    this.toast.success('Export ready', `${request.rows.length} rows exported to CSV.`);
  }

  private exportJson<T>(request: ExportRequest<T>, columns: readonly TableColumn<T>[]): void {
    const payload = request.rows.map((row) => {
      const entry: Record<string, string> = {};
      for (const column of columns) {
        entry[column.key] = this.cellValue(row, column);
      }
      return entry;
    });
    triggerDownload(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' }),
      timestampedFileName(request.fileName, 'json'),
    );
    this.toast.success('Export ready', `${request.rows.length} rows exported to JSON.`);
  }

  /** HTML-table workbook — opens natively in Excel, Numbers and Sheets. */
  private exportExcel<T>(request: ExportRequest<T>, columns: readonly TableColumn<T>[]): void {
    const { headers, body } = this.matrix(request.rows, columns);
    const rows = request.includeTotals ? [...body, this.totalsRow(request.rows, columns)] : body;
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" />
<style>
  table { border-collapse: collapse; font-family: Calibri, sans-serif; font-size: 11pt; }
  th { background: #0b3d91; color: #ffffff; font-weight: 600; border: 1px solid #d0d7e2; padding: 6px 10px; text-align: left; }
  td { border: 1px solid #d0d7e2; padding: 5px 10px; }
  tr:nth-child(even) td { background: #f4f7fc; }
  caption { font-size: 14pt; font-weight: 700; text-align: left; padding-bottom: 8px; }
</style></head><body>
<table>
  <caption>${escapeHtml(request.title)}${request.subtitle ? ` — ${escapeHtml(request.subtitle)}` : ''}</caption>
  <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
  <tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('')}</tbody>
</table></body></html>`;

    triggerDownload(
      new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
      timestampedFileName(request.fileName, 'xls'),
    );
    this.toast.success('Export ready', `${request.rows.length} rows exported to Excel.`);
  }

  /**
   * Renders a print-ready document. The browser's print dialog provides
   * "Save as PDF", which avoids shipping a heavyweight PDF library.
   */
  private exportPrintable<T>(
    request: ExportRequest<T>,
    columns: readonly TableColumn<T>[],
    asPdf: boolean,
  ): void {
    const { headers, body } = this.matrix(request.rows, columns);
    const rows = request.includeTotals ? [...body, this.totalsRow(request.rows, columns)] : body;
    const branding = this.theme.branding();
    const palette = this.theme.palette();
    const generated = new Date().toLocaleString(this.theme.regional().locale);

    const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>${escapeHtml(request.title)}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #111827; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 3px solid ${palette.primary}; padding-bottom: 12px; margin-bottom: 18px; }
  h1 { font-size: 18pt; margin: 0 0 4px; color: ${palette.primary}; }
  .subtitle { font-size: 9pt; color: #4b5563; }
  .meta { text-align: right; font-size: 8.5pt; color: #6b7280; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { background: ${palette.primary}; color: #fff; text-align: left; padding: 7px 9px;
       border: 1px solid ${palette.primary}; }
  td { padding: 6px 9px; border: 1px solid #e5e7eb; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody tr:last-child td { font-weight: 700; background: #eef2f7; }
  footer { margin-top: 16px; font-size: 8pt; color: #6b7280; display: flex; justify-content: space-between;
           border-top: 1px solid #e5e7eb; padding-top: 8px; }
  thead { display: table-header-group; }
</style></head><body>
<header>
  <div>
    <h1>${escapeHtml(request.title)}</h1>
    ${request.subtitle ? `<div class="subtitle">${escapeHtml(request.subtitle)}</div>` : ''}
  </div>
  <div class="meta">
    <strong>${escapeHtml(branding.applicationName)}</strong><br />
    Generated ${escapeHtml(generated)}<br />
    ${rows.length} row(s)
  </div>
</header>
<table>
  <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
  <tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('')}</tbody>
</table>
<footer><span>${escapeHtml(branding.footerText)}</span><span>${escapeHtml(branding.copyright)}</span></footer>
</body></html>`;

    const frame = this.document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    this.document.body.appendChild(frame);

    const frameDocument = frame.contentDocument;
    if (!frameDocument) {
      this.document.body.removeChild(frame);
      this.toast.error('Print failed', 'The browser blocked the print view.');
      return;
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    // Let fonts and layout settle before invoking the print dialog.
    frame.onload = (): void => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 1000);
    };

    this.toast.info(
      asPdf ? 'PDF ready' : 'Print ready',
      asPdf ? 'Choose "Save as PDF" in the print dialog.' : 'The print dialog has been opened.',
    );
  }
}
