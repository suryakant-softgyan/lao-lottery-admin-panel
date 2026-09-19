/**
 * Minimal STOMP 1.2 client over a native WebSocket — enough to CONNECT with a bearer token and
 * SUBSCRIBE to server → client destinations. Avoids pulling a STOMP library into the bundle.
 * Reconnects with a capped back-off until {@link StompLite.close} is called.
 */
export class StompLite {
  private socket: WebSocket | null = null;
  private closed = false;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly url: string,
    private readonly token: () => string | null,
    private readonly subscriptions: Record<string, (body: unknown) => void>,
    private readonly onState: (connected: boolean) => void = () => undefined,
  ) {}

  open(): void {
    this.closed = false;
    this.connect();
  }

  close(): void {
    this.closed = true;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.socket?.close();
    this.socket = null;
  }

  private connect(): void {
    const token = this.token();
    if (this.closed || !token) {
      return;
    }
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onopen = (): void => {
      socket.send(`CONNECT\naccept-version:1.2\nheart-beat:0,0\nAuthorization:Bearer ${token}\n\n\0`);
    };

    socket.onmessage = (event: MessageEvent<string>): void => {
      for (const frame of String(event.data).split('\0')) {
        const text = frame.replace(/^\n+/, '');
        if (!text) {
          continue;
        }
        const divider = text.indexOf('\n\n');
        const head = (divider === -1 ? text : text.slice(0, divider)).split('\n');
        const command = head[0];
        if (command === 'CONNECTED') {
          this.attempt = 0;
          this.onState(true);
          Object.keys(this.subscriptions).forEach((destination, index) =>
            socket.send(`SUBSCRIBE\nid:sub-${index}\ndestination:${destination}\n\n\0`),
          );
        } else if (command === 'MESSAGE') {
          const destination = head.find((line) => line.startsWith('destination:'))?.slice('destination:'.length) ?? '';
          const handler = Object.entries(this.subscriptions).find(
            ([key]) => destination === key || destination.endsWith(key.replace(/^\/user/, '')),
          )?.[1];
          try {
            handler?.(JSON.parse(text.slice(divider + 2)));
          } catch {
            // ignore a frame that is not JSON
          }
        }
      }
    };

    socket.onclose = (): void => {
      this.onState(false);
      if (!this.closed) {
        this.attempt += 1;
        this.timer = setTimeout(() => this.connect(), Math.min(30_000, 1_000 * 2 ** Math.min(this.attempt, 5)));
      }
    };
  }
}

/** `/ws` (proxied in dev) or an absolute `wss://…` URL from the environment. */
export function resolveWsUrl(configured: string): string {
  if (/^wss?:\/\//i.test(configured)) {
    return configured;
  }
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}${configured.startsWith('/') ? '' : '/'}${configured}`;
}
