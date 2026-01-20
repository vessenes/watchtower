import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { TerminalInstance } from './terminal';

export interface TerminalPanel {
  id: string;
  mesh: THREE.Mesh;
  texture: THREE.CanvasTexture;
}

interface FocusAnimation {
  startPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  progress: number;
  duration: number;
}

export class WatchtowerScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private panels: Map<string, TerminalPanel> = new Map();
  private sphereRadius = 10;

  // Click-to-focus state
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private focusedPanel: TerminalPanel | null = null;
  private focusAnimation: FocusAnimation | null = null;
  private readonly focusDistance = 3;
  private readonly animationDuration = 500; // ms
  private lastTime = performance.now();

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

    // Click handler for focus/zoom
    this.renderer.domElement.addEventListener('click', (event) => this.onClick(event));

    // Escape key to unfocus
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.focusedPanel) {
        this.unfocus();
      }
    });
  }

  private onClick(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const meshes = Array.from(this.panels.values()).map(p => p.mesh);
    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object as THREE.Mesh;
      const panel = Array.from(this.panels.values()).find(p => p.mesh === clickedMesh);

      if (panel) {
        if (this.focusedPanel === panel) {
          // Clicking focused panel unfocuses
          this.unfocus();
        } else {
          // Focus on the clicked panel
          this.focusOn(panel);
        }
      }
    } else if (this.focusedPanel) {
      // Clicking empty space unfocuses
      this.unfocus();
    }
  }

  private focusOn(panel: TerminalPanel): void {
    this.focusedPanel = panel;
    this.controls.enabled = false;

    // Calculate position in front of the panel
    const panelPosition = panel.mesh.position.clone();
    const direction = panelPosition.clone().normalize();
    const targetPosition = direction.multiplyScalar(this.sphereRadius - this.focusDistance);

    this.focusAnimation = {
      startPosition: this.camera.position.clone(),
      targetPosition,
      startTarget: this.controls.target.clone(),
      endTarget: panelPosition.clone(),
      progress: 0,
      duration: this.animationDuration,
    };
  }

  private unfocus(): void {
    if (!this.focusedPanel) return;

    // Animate back to center
    this.focusAnimation = {
      startPosition: this.camera.position.clone(),
      targetPosition: new THREE.Vector3(0, 0, 0.1),
      startTarget: this.controls.target.clone(),
      endTarget: new THREE.Vector3(0, 0, 0),
      progress: 0,
      duration: this.animationDuration,
    };

    this.focusedPanel = null;
  }

  private updateFocusAnimation(deltaTime: number): void {
    if (!this.focusAnimation) return;

    this.focusAnimation.progress += deltaTime;
    const t = Math.min(this.focusAnimation.progress / this.focusAnimation.duration, 1);

    // Ease out cubic for smooth deceleration
    const eased = 1 - Math.pow(1 - t, 3);

    this.camera.position.lerpVectors(
      this.focusAnimation.startPosition,
      this.focusAnimation.targetPosition,
      eased
    );

    this.controls.target.lerpVectors(
      this.focusAnimation.startTarget,
      this.focusAnimation.endTarget,
      eased
    );

    if (t >= 1) {
      this.focusAnimation = null;
      if (!this.focusedPanel) {
        // Re-enable controls when unfocused
        this.controls.enabled = true;
      }
    }
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
    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;

    this.updateFocusAnimation(deltaTime);
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
