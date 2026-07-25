import { Injectable, computed, signal } from '@angular/core';

import { TOAST_DURATION } from '../constants/app.constants';

export type ToastTone = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: string;
  title: string;
  message?: string;
  tone: ToastTone;
  icon: string;
  /** 0 keeps the toast until it is dismissed. */
  duration: number;
  action?: ToastAction;
  createdAt: number;
  /** Rendered as a fixed banner rather than a floating toast. */
  banner?: boolean;
}

const TONE_ICON: Record<ToastTone, string> = {
  success: 'check_circle',
  warning: 'warning',
  danger: 'error',
  info: 'info',
  primary: 'campaign',
  neutral: 'notifications',
};

/**
 * Floating notification queue.
 *
 * A signal-backed stack rendered by the shell's toast host, so any service or
 * component can raise feedback without injecting a UI dependency.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<Toast[]>([]);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private sequence = 0;

  readonly toasts = this.items.asReadonly();
  readonly hasToasts = computed(() => this.items().length > 0);

  show(
    title: string,
    options: {
      message?: string;
      tone?: ToastTone;
      icon?: string;
      duration?: number;
      action?: ToastAction;
      banner?: boolean;
    } = {},
  ): string {
    const tone = options.tone ?? 'info';
    const id = `toast-${++this.sequence}`;
    const toast: Toast = {
      id,
      title,
      message: options.message,
      tone,
      icon: options.icon ?? TONE_ICON[tone],
      duration: options.duration ?? TOAST_DURATION.normal,
      action: options.action,
      createdAt: Date.now(),
      banner: options.banner,
    };

    // Cap the stack so a burst of errors cannot cover the screen.
    this.items.update((current) => [toast, ...current].slice(0, 5));

    if (toast.duration > 0) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), toast.duration),
      );
    }
    return id;
  }

  success(title: string, message?: string): string {
    return this.show(title, { message, tone: 'success' });
  }

  info(title: string, message?: string): string {
    return this.show(title, { message, tone: 'info' });
  }

  warning(title: string, message?: string): string {
    return this.show(title, { message, tone: 'warning', duration: TOAST_DURATION.long });
  }

  error(title: string, message?: string, action?: ToastAction): string {
    return this.show(title, { message, tone: 'danger', duration: TOAST_DURATION.long, action });
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.items.update((current) => current.filter((toast) => toast.id !== id));
  }

  clear(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.items.set([]);
  }
}
