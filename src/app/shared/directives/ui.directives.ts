import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  Renderer2,
  inject,
  output,
} from '@angular/core';

/** Focuses the host once it is in the DOM — used by dialogs and search fields. */
@Directive({ selector: '[llAutofocus]' })
export class AutofocusDirective implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Delay in milliseconds, to run after an entrance animation. */
  @Input() llAutofocus: number | '' = '';

  ngAfterViewInit(): void {
    const delay = this.llAutofocus === '' ? 90 : Number(this.llAutofocus);
    setTimeout(() => this.host.nativeElement.focus(), delay);
  }
}

/** Emits when a click lands outside the host — closes popovers and dropdowns. */
@Directive({ selector: '[llClickOutside]' })
export class ClickOutsideDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly llClickOutside = output<MouseEvent>();

  @HostListener('document:mousedown', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.llClickOutside.emit(event);
    }
  }
}

/** Restricts an input to digits, with optional decimal support. */
@Directive({ selector: 'input[llNumericOnly]' })
export class NumericOnlyDirective {
  private readonly host = inject<ElementRef<HTMLInputElement>>(ElementRef);

  @Input() allowDecimal = false;
  @Input() allowNegative = false;

  @HostListener('input')
  onInput(): void {
    const element = this.host.nativeElement;
    let pattern = '0-9';
    if (this.allowDecimal) {
      pattern += '.';
    }
    if (this.allowNegative) {
      pattern += '-';
    }
    const cleaned = element.value.replace(new RegExp(`[^${pattern}]`, 'g'), '');
    if (cleaned !== element.value) {
      element.value = cleaned;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

/**
 * Makes a table column resizable by dragging its trailing edge.
 *
 * Listeners are bound outside Angular's zone so a drag does not trigger change
 * detection on every mouse move; the final width is emitted once on release.
 */
@Directive({ selector: '[llResizableColumn]' })
export class ResizableColumnDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly zone = inject(NgZone);

  /** Minimum width in pixels. */
  @Input() minWidth = 80;

  readonly widthChange = output<number>();

  private handle?: HTMLElement;
  private startX = 0;
  private startWidth = 0;
  private dragging = false;
  private disposers: (() => void)[] = [];

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.attachHandle());
  }

  ngOnDestroy(): void {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
  }

  private attachHandle(): void {
    const handle = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(handle, 'll-column-resize-handle');
    this.renderer.appendChild(this.host.nativeElement, handle);
    this.handle = handle;

    this.disposers.push(
      this.renderer.listen(handle, 'mousedown', (event: MouseEvent) => this.onMouseDown(event)),
      this.renderer.listen('document', 'mousemove', (event: MouseEvent) => this.onMouseMove(event)),
      this.renderer.listen('document', 'mouseup', () => this.onMouseUp()),
    );
  }

  private onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging = true;
    this.startX = event.pageX;
    this.startWidth = this.host.nativeElement.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.dragging) {
      return;
    }
    const width = Math.max(this.minWidth, this.startWidth + (event.pageX - this.startX));
    this.renderer.setStyle(this.host.nativeElement, 'width', `${width}px`);
    this.renderer.setStyle(this.host.nativeElement, 'min-width', `${width}px`);
  }

  private onMouseUp(): void {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    const width = this.host.nativeElement.offsetWidth;
    // Back into the zone only once, with the final value.
    this.zone.run(() => this.widthChange.emit(width));
  }
}

/** Copies text to the clipboard and emits once it lands. */
@Directive({ selector: '[llCopyToClipboard]' })
export class CopyToClipboardDirective {
  @Input({ required: true }) llCopyToClipboard = '';

  readonly copied = output<string>();

  @HostListener('click')
  async onClick(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.llCopyToClipboard);
      this.copied.emit(this.llCopyToClipboard);
    } catch {
      // Clipboard access can be denied; the caller decides how to react.
      this.copied.emit('');
    }
  }
}

export const UI_DIRECTIVES = [
  AutofocusDirective,
  ClickOutsideDirective,
  NumericOnlyDirective,
  ResizableColumnDirective,
  CopyToClipboardDirective,
] as const;
