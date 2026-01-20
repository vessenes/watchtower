import '@xterm/xterm/css/xterm.css';
import './style.css';

import { WatchtowerClient } from './ws';
import { TerminalManager } from './terminal';
import { WatchtowerScene } from './scene';
import type { PaneUpdate, PaneList } from './types';
import { getPaneId } from './types';

// Get WebSocket URL from current location or use default
function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host || 'localhost:8080';
  return `${protocol}//${host}/ws`;
}

class Watchtower {
  private client: WatchtowerClient;
  private terminals: TerminalManager;
  private scene: WatchtowerScene;
  private animationId: number | null = null;

  constructor() {
    // Create container
    const container = document.getElementById('app');
    if (!container) {
      throw new Error('No #app container found');
    }
    container.innerHTML = '';

    // Initialize components
    this.terminals = new TerminalManager();
    this.scene = new WatchtowerScene(container);

    this.client = new WatchtowerClient(getWsUrl(), {
      onPaneUpdate: (update) => this.handlePaneUpdate(update),
      onPaneList: (list) => this.handlePaneList(list),
      onConnect: () => this.handleConnect(),
      onDisconnect: () => this.handleDisconnect(),
    });
  }

  start(): void {
    this.client.connect();
    this.startRenderLoop();
  }

  private handleConnect(): void {
    console.log('[watchtower] connected to server');
  }

  private handleDisconnect(): void {
    console.log('[watchtower] disconnected from server');
  }

  private handlePaneUpdate(update: PaneUpdate): void {
    this.terminals.updateTerminal(update);
  }

  private handlePaneList(list: PaneList): void {
    console.log('[watchtower] received pane list:', list.panes.length, 'panes');

    // Create terminals for any new panes
    const currentIds = new Set(this.terminals.getAllTerminals().map(t => t.id));
    const newIds = new Set(list.panes.map(p => getPaneId(p.session, p.window, p.pane)));

    // Remove terminals that are no longer in the list
    for (const id of currentIds) {
      if (!newIds.has(id)) {
        this.terminals.removeTerminal(id);
      }
    }
  }

  private startRenderLoop(): void {
    const render = () => {
      this.scene.updatePanels(this.terminals.getAllTerminals());
      this.scene.render();
      this.animationId = requestAnimationFrame(render);
    };
    render();
  }

  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    this.client.disconnect();
    this.terminals.dispose();
    this.scene.dispose();
  }
}

// Start the application
const app = new Watchtower();
app.start();
