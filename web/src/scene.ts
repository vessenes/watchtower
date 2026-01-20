import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { TerminalInstance } from './terminal';

export interface TerminalPanel {
  id: string;
  mesh: THREE.Mesh;
  texture: THREE.CanvasTexture;
}

export class WatchtowerScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private panels: Map<string, TerminalPanel> = new Map();
  private sphereRadius = 10;

  constructor(container: HTMLElement) {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);

    // Camera at center of sphere
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 0.1);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Orbit controls for looking around
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableZoom = true;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.5;
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 0.1;

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambientLight);

    // Handle window resize
    window.addEventListener('resize', () => this.onResize(container));
  }

  private onResize(container: HTMLElement): void {
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  updatePanels(terminals: TerminalInstance[]): void {
    const existingIds = new Set(this.panels.keys());
    const currentIds = new Set(terminals.map(t => t.id));

    // Remove panels for terminals that no longer exist
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        const panel = this.panels.get(id)!;
        this.scene.remove(panel.mesh);
        panel.texture.dispose();
        panel.mesh.geometry.dispose();
        (panel.mesh.material as THREE.Material).dispose();
        this.panels.delete(id);
      }
    }

    // Add/update panels
    const count = terminals.length;
    terminals.forEach((terminal, index) => {
      if (!terminal.canvas) return;

      let panel = this.panels.get(terminal.id);

      if (!panel) {
        // Create new panel
        panel = this.createPanel(terminal, index, count);
        this.panels.set(terminal.id, panel);
      } else if (terminal.needsUpdate) {
        // Update existing texture
        panel.texture.needsUpdate = true;
        terminal.needsUpdate = false;
      }

      // Reposition if panel count changed
      this.positionPanel(panel.mesh, index, count);
    });
  }

  private createPanel(terminal: TerminalInstance, index: number, total: number): TerminalPanel {
    const texture = new THREE.CanvasTexture(terminal.canvas!);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Panel dimensions based on terminal size
    const width = 4;
    const height = 3;

    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.positionPanel(mesh, index, total);
    this.scene.add(mesh);

    terminal.needsUpdate = false;

    return { id: terminal.id, mesh, texture };
  }

  private positionPanel(mesh: THREE.Mesh, index: number, total: number): void {
    // Distribute panels on inner surface of sphere
    // Using fibonacci sphere distribution for even spacing
    const phi = Math.acos(1 - 2 * (index + 0.5) / total);
    const theta = Math.PI * (1 + Math.sqrt(5)) * (index + 0.5);

    const x = this.sphereRadius * Math.sin(phi) * Math.cos(theta);
    const y = this.sphereRadius * Math.cos(phi);
    const z = this.sphereRadius * Math.sin(phi) * Math.sin(theta);

    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    for (const panel of this.panels.values()) {
      this.scene.remove(panel.mesh);
      panel.texture.dispose();
      panel.mesh.geometry.dispose();
      (panel.mesh.material as THREE.Material).dispose();
    }
    this.panels.clear();
    this.renderer.dispose();
    this.controls.dispose();
  }
}
