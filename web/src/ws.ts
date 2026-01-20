import type { ServerMessage, PaneUpdate, PaneList } from './types';

export type MessageHandler = {
  onPaneUpdate: (update: PaneUpdate) => void;
  onPaneList: (list: PaneList) => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

export class WatchtowerClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: MessageHandler;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;

  constructor(url: string, handlers: MessageHandler) {
    this.url = url;
    this.handlers = handlers;
  }

  connect(): void {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('[ws] connected');
      this.reconnectDelay = 1000;
      this.handlers.onConnect();
    };

    this.ws.onclose = () => {
      console.log('[ws] disconnected');
      this.handlers.onDisconnect();
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[ws] error:', err);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('[ws] failed to parse message:', err);
      }
    };
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'pane_update':
        this.handlers.onPaneUpdate(msg);
        break;
      case 'pane_list':
        this.handlers.onPaneList(msg);
        break;
      default:
        console.warn('[ws] unknown message type:', (msg as any).type);
    }
  }

  private scheduleReconnect(): void {
    setTimeout(() => {
      console.log('[ws] reconnecting...');
      this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
