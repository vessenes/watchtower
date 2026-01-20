import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { PaneUpdate } from './types';
import { getPaneId } from './types';

export interface TerminalInstance {
  id: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  container: HTMLDivElement;
  canvas: HTMLCanvasElement | null;
  needsUpdate: boolean;
}

export class TerminalManager {
  private terminals: Map<string, TerminalInstance> = new Map();
  private offscreenContainer: HTMLDivElement;

  constructor() {
    // Create offscreen container for terminal rendering
    this.offscreenContainer = document.createElement('div');
    this.offscreenContainer.style.position = 'absolute';
    this.offscreenContainer.style.left = '-9999px';
    this.offscreenContainer.style.top = '-9999px';
    document.body.appendChild(this.offscreenContainer);
  }

  getTerminal(id: string): TerminalInstance | undefined {
    return this.terminals.get(id);
  }

  getAllTerminals(): TerminalInstance[] {
    return Array.from(this.terminals.values());
  }

  createTerminal(session: string, window: string, pane: string, cols: number, rows: number): TerminalInstance {
    const id = getPaneId(session, window, pane);

    if (this.terminals.has(id)) {
      return this.terminals.get(id)!;
    }

    const container = document.createElement('div');
    container.style.width = `${cols * 9}px`;
    container.style.height = `${rows * 17}px`;
    this.offscreenContainer.appendChild(container);

    const terminal = new Terminal({
      cols,
      rows,
      fontSize: 14,
      fontFamily: 'monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    const instance: TerminalInstance = {
      id,
      terminal,
      fitAddon,
      container,
      canvas: null,
      needsUpdate: false,
    };

    // Get canvas reference after terminal is opened
    const canvasEl = container.querySelector('canvas');
    if (canvasEl) {
      instance.canvas = canvasEl;
    }

    this.terminals.set(id, instance);
    return instance;
  }

  updateTerminal(update: PaneUpdate): void {
    const id = getPaneId(update.session, update.window, update.pane);
    let instance = this.terminals.get(id);

    if (!instance) {
      instance = this.createTerminal(
        update.session,
        update.window,
        update.pane,
        update.size.cols,
        update.size.rows
      );
    }

    // Resize if needed
    if (instance.terminal.cols !== update.size.cols || instance.terminal.rows !== update.size.rows) {
      instance.terminal.resize(update.size.cols, update.size.rows);
      instance.container.style.width = `${update.size.cols * 9}px`;
      instance.container.style.height = `${update.size.rows * 17}px`;
    }

    // Clear and write new content
    instance.terminal.reset();
    instance.terminal.write(update.content);

    // Update canvas reference
    const canvasEl = instance.container.querySelector('canvas');
    if (canvasEl) {
      instance.canvas = canvasEl;
    }

    instance.needsUpdate = true;
  }

  removeTerminal(id: string): void {
    const instance = this.terminals.get(id);
    if (instance) {
      instance.terminal.dispose();
      instance.container.remove();
      this.terminals.delete(id);
    }
  }

  dispose(): void {
    for (const instance of this.terminals.values()) {
      instance.terminal.dispose();
      instance.container.remove();
    }
    this.terminals.clear();
    this.offscreenContainer.remove();
  }
}
