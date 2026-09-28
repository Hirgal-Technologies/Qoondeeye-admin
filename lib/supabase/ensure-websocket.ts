/**
 * Supabase constructs a Realtime socket for every client, including the
 * server-only clients this dashboard uses for auth and queries. Those clients
 * never subscribe to Realtime. Node 22 provides WebSocket; Node 20 does not.
 */
export function ensureServerWebSocket() {
  if (typeof globalThis.WebSocket !== "undefined") return;

  class ClosedWebSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = 3;

    constructor(public url?: string) {
      super();
    }

    close() {}
    send() {}
  }

  globalThis.WebSocket = ClosedWebSocket as unknown as typeof WebSocket;
}
