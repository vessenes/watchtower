// WebSocket message types from server

export interface PaneInfo {
  session: string;
  window: string;
  pane: string;
  title: string;
}

export interface PaneUpdate {
  type: 'pane_update';
  session: string;
  window: string;
  pane: string;
  content: string;
  cursor: { x: number; y: number };
  size: { cols: number; rows: number };
}

export interface PaneList {
  type: 'pane_list';
  panes: PaneInfo[];
}

export type ServerMessage = PaneUpdate | PaneList;

export function getPaneId(session: string, window: string, pane: string): string {
  return `${session}:${window}:${pane}`;
}
