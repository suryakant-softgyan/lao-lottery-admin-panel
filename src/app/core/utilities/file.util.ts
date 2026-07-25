/** Browser download helpers shared by the export service. */

export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** RFC 4180 escaping — quotes are doubled, separators force quoting. */
export function escapeCsvCell(value: unknown, separator = ','): string {
  const text = value === null || value === undefined ? '' : String(value);
  const needsQuoting =
    text.includes(separator) || text.includes('"') || text.includes('\n') || text.includes('\r');
  return needsQuoting ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
  separator = ',',
): string {
  const lines = [headers.map((header) => escapeCsvCell(header, separator)).join(separator)];
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvCell(cell, separator)).join(separator));
  }
  // BOM keeps Excel happy with UTF-8 (Lao script in particular).
  return `﻿${lines.join('\r\n')}`;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => resolve(String(reader.result));
    reader.onerror = (): void => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function fileExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index === -1 ? '' : fileName.slice(index + 1).toLowerCase();
}

/** Timestamped export file name, e.g. `users-2026-07-25-1432.csv`. */
export function timestampedFileName(base: string, extension: string, now: Date = new Date()): string {
  const pad = (value: number): string => value.toString().padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${base}-${stamp}.${extension}`;
}
