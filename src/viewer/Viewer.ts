import {
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  type Material,
  MathUtils,
  Matrix4,
  Mesh,
  NeutralToneMapping,
  type Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  Quaternion,
  Scene,
  Sphere,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Vec3 } from '../catalog/types';
import { axesFrom, boxCorners, fitDistance, type ModelAxes, type ViewName, viewDirection } from './framing';

export interface LoadRequest {
  url: string;
  forward: Vec3;
  up: Vec3;
  onProgress?: (fraction: number | null) => void;
}

export interface LoadedModelInfo {
  /** Axis-aligned size along the model's right, up and forward axes. */
  size: { width: number; height: number; length: number };
  triangles: number;
}

export interface LightingSettings {
  /** Key light strength, 0–3. */
  intensity: number;
  /** Key light azimuth around the model in degrees, 0–360. */
  azimuth: number;
  /** Fill (sky/ground + reflections) strength, 0–2. */
  ambient: number;
}

export const DEFAULT_LIGHTING: LightingSettings = { intensity: 1.6, azimuth: 35, ambient: 0.8 };

const FOV = 35;
const VIEW_TRANSITION_MS = 650;
const SPIN_DURATION_MS = 6000;
const MAX_FRAME_POINTS = 20000;

type Animation = { kind: 'view' | 'spin'; cancel: () => void };

/**
 * Model-agnostic Three.js viewer: loads one glTF model at a time, frames it
 * from its bounds, and exposes camera presets, wireframe, lighting and a
 * single 360° turn. Knows nothing about the catalog or the DOM controls.
 */
export class Viewer {
  readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 1000);
  private readonly controls: OrbitControls;
  private readonly loader = new GLTFLoader();
  private readonly keyLight = new DirectionalLight(0xffffff, DEFAULT_LIGHTING.intensity);
  private readonly hemiLight = new HemisphereLight(0xdfe9ff, 0x1a2333, DEFAULT_LIGHTING.ambient);
  private readonly resizeObserver: ResizeObserver;

  private model: Object3D | null = null;
  private bounds = new Box3();
  /** World-space vertex sample used for framing (capped for huge models). */
  private framePoints: Vector3[] = [];
  /** World axes after the model is re-oriented to forward = -Z, up = +Y. */
  private readonly axes: ModelAxes = axesFrom([0, 0, -1], [0, 1, 0]);
  private radius = 1;
  private lighting: LightingSettings = { ...DEFAULT_LIGHTING };
  private wireframe = false;
  private animation: Animation | null = null;
  private loadToken = 0;
  private needsRender = true;
  private frameHandle = 0;

  /** Called when a 360° turn starts (true) or ends/is interrupted (false). */
  onSpinChange: (spinning: boolean) => void = () => {};

  constructor(private readonly container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.domElement.classList.add('viewer-canvas');
    container.appendChild(this.renderer.domElement);

    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = DEFAULT_LIGHTING.ambient * 0.6;

    this.hemiLight.color = new Color(0xdfe9ff);
    this.scene.add(this.hemiLight, this.keyLight, this.keyLight.target);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('change', () => this.requestRender());
    // Any direct manipulation interrupts a preset transition or a 360° turn.
    this.controls.addEventListener('start', () => this.stopAnimation());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.loop();
  }

  async load({ url, forward, up, onProgress }: LoadRequest): Promise<LoadedModelInfo> {
    const token = ++this.loadToken;
    this.stopAnimation();
    const gltf = await this.loader.loadAsync(url, (event) => {
      if (token !== this.loadToken) return;
      onProgress?.(event.lengthComputable && event.total > 0 ? event.loaded / event.total : null);
    });
    if (token !== this.loadToken) throw new DOMException('Superseded by a newer load', 'AbortError');

    this.clearModel();
    const model = gltf.scene;
    let triangles = 0;
    model.traverse((node) => {
      if (node instanceof Mesh) {
        const geometry = node.geometry;
        triangles += (geometry.index ? geometry.index.count : geometry.attributes.position!.count) / 3;
      }
    });
    // Rotate the model into the viewer's convention (nose toward -Z, up +Y) so
    // camera presets and OrbitControls behave the same for every model.
    const own = axesFrom(forward, up);
    const toModel = new Matrix4().makeBasis(own.right, own.up, own.forward.clone().negate());
    model.quaternion.setFromRotationMatrix(toModel.transpose());
    model.updateMatrixWorld(true);
    this.model = model;
    this.scene.add(model);
    this.bounds = new Box3().setFromObject(model);
    this.radius = this.bounds.getBoundingSphere(new Sphere()).radius || 1;
    this.framePoints = sampleVertices(model, MAX_FRAME_POINTS);
    if (this.framePoints.length === 0) this.framePoints = boxCorners(this.bounds);
    this.applyWireframe();
    this.configureForBounds();
    this.applyLighting();
    this.setView('perspective', false);

    const size = this.bounds.getSize(new Vector3());
    const along = (axis: Vector3) => Math.abs(size.x * axis.x) + Math.abs(size.y * axis.y) + Math.abs(size.z * axis.z);
    return {
      size: { width: along(this.axes.right), height: along(this.axes.up), length: along(this.axes.forward) },
      triangles,
    };
  }

  setView(view: ViewName, animate = true): void {
    if (!this.model) return;
    this.stopAnimation();
    const direction = viewDirection(view, this.axes);
    const target = this.bounds.getCenter(new Vector3());
    const distance = fitDistance(this.framePoints, target, direction, this.camera.fov, this.camera.aspect);
    const toPosition = target.clone().addScaledVector(direction, distance);
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.camera.position.copy(toPosition);
      this.controls.target.copy(target);
      this.controls.update();
      this.requestRender();
      return;
    }
    this.animateCamera(toPosition, target);
  }

  resetCamera(): void {
    this.setView('perspective');
  }

  /** One full turn around the model's up axis, then stop where it started. */
  rotate360(): void {
    if (!this.model) return;
    this.stopAnimation();
    const target = this.controls.target.clone();
    const startOffset = this.camera.position.clone().sub(target);
    const axis = this.axes.up.clone();
    const rotation = new Quaternion();
    const start = performance.now();
    let handle = 0;
    const step = (now: number) => {
      const t = Math.min((now - start) / SPIN_DURATION_MS, 1);
      const eased = t < 1 ? 0.5 - Math.cos(Math.PI * t) / 2 : 1;
      rotation.setFromAxisAngle(axis, eased * Math.PI * 2);
      this.camera.position.copy(target).add(startOffset.clone().applyQuaternion(rotation));
      this.camera.lookAt(target);
      this.requestRender();
      if (t < 1) {
        handle = requestAnimationFrame(step);
      } else {
        this.camera.position.copy(target).add(startOffset);
        this.controls.update();
        this.finishAnimation();
      }
    };
    this.animation = { kind: 'spin', cancel: () => cancelAnimationFrame(handle) };
    this.onSpinChange(true);
    handle = requestAnimationFrame(step);
  }

  get isSpinning(): boolean {
    return this.animation?.kind === 'spin';
  }

  setWireframe(enabled: boolean): void {
    this.wireframe = enabled;
    this.applyWireframe();
  }

  setLighting(settings: Partial<LightingSettings>): void {
    this.lighting = { ...this.lighting, ...settings };
    this.applyLighting();
  }

  getLighting(): LightingSettings {
    return { ...this.lighting };
  }

  dispose(): void {
    this.stopAnimation();
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clearModel();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private configureForBounds(): void {
    const r = this.radius;
    this.camera.near = r / 100;
    this.camera.far = r * 100;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = r * 0.6;
    this.controls.maxDistance = r * 8;
  }

  private applyWireframe(): void {
    this.model?.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const materials: Material[] = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if ('wireframe' in material) {
          (material as Material & { wireframe: boolean }).wireframe = this.wireframe;
        }
      }
    });
    this.requestRender();
  }

  private applyLighting(): void {
    const { intensity, azimuth, ambient } = this.lighting;
    this.keyLight.intensity = intensity;
    this.hemiLight.intensity = ambient;
    this.scene.environmentIntensity = ambient * 0.6;

    // Place the key light on a ring around the model, 45° above the horizon,
    // measured from the nose toward the right wing.
    const center = this.bounds.isEmpty() ? new Vector3() : this.bounds.getCenter(new Vector3());
    const angle = MathUtils.degToRad(azimuth);
    const { forward, right, up } = this.axes;
    const horizontal = forward.clone().multiplyScalar(Math.cos(angle)).addScaledVector(right, Math.sin(angle));
    const direction = horizontal.multiplyScalar(Math.SQRT1_2).addScaledVector(up, Math.SQRT1_2);
    this.keyLight.position.copy(center).addScaledVector(direction, this.radius * 4);
    this.keyLight.target.position.copy(center);
    this.requestRender();
  }

  private animateCamera(toPosition: Vector3, toTarget: Vector3): void {
    const fromPosition = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    const fromOffset = fromPosition.clone().sub(fromTarget);
    const toOffset = toPosition.clone().sub(toTarget);
    const fromLength = fromOffset.length();
    const toLength = toOffset.length();
    const fromDir = fromOffset.normalize();
    const toDir = toOffset.normalize();
    const turn = new Quaternion().setFromUnitVectors(fromDir, toDir);
    const identity = new Quaternion();
    const partial = new Quaternion();
    const start = performance.now();
    let handle = 0;
    const step = (now: number) => {
      const t = Math.min((now - start) / VIEW_TRANSITION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      // Swing around the target (spherical path) rather than cutting through the model.
      partial.slerpQuaternions(identity, turn, eased);
      const direction = fromDir.clone().applyQuaternion(partial);
      const length = MathUtils.lerp(fromLength, toLength, eased);
      this.controls.target.lerpVectors(fromTarget, toTarget, eased);
      this.camera.position.copy(this.controls.target).addScaledVector(direction, length);
      this.camera.lookAt(this.controls.target);
      this.requestRender();
      if (t < 1) {
        handle = requestAnimationFrame(step);
      } else {
        this.camera.position.copy(toPosition);
        this.controls.target.copy(toTarget);
        this.controls.update();
        this.finishAnimation();
      }
    };
    this.animation = { kind: 'view', cancel: () => cancelAnimationFrame(handle) };
    handle = requestAnimationFrame(step);
  }

  private stopAnimation(): void {
    if (!this.animation) return;
    this.animation.cancel();
    this.controls.update();
    this.finishAnimation();
  }

  private finishAnimation(): void {
    const wasSpinning = this.animation?.kind === 'spin';
    this.animation = null;
    if (wasSpinning) this.onSpinChange(false);
  }

  private clearModel(): void {
    if (!this.model) return;
    this.scene.remove(this.model);
    this.model.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.geometry.dispose();
      const materials: Material[] = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value && typeof value === 'object' && 'isTexture' in value) (value as { dispose(): void }).dispose();
        }
        material.dispose();
      }
    });
    this.model = null;
    this.bounds.makeEmpty();
    this.framePoints = [];
  }

  private resize(): void {
    const { clientWidth, clientHeight } = this.container;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private requestRender(): void {
    this.needsRender = true;
  }

  private loop = (): void => {
    this.frameHandle = requestAnimationFrame(this.loop);
    // Damping keeps the camera moving for a few frames after input stops.
    if (!this.animation && this.controls.update()) this.needsRender = true;
    if (!this.needsRender) return;
    this.needsRender = false;
    this.renderer.render(this.scene, this.camera);
  };
}

/** Collects up to `limit` world-space vertex positions, evenly strided. */
function sampleVertices(root: Object3D, limit: number): Vector3[] {
  const meshes: Mesh[] = [];
  let total = 0;
  root.traverse((node) => {
    if (node instanceof Mesh && node.geometry.attributes.position) {
      meshes.push(node);
      total += node.geometry.attributes.position.count;
    }
  });
  const stride = Math.max(1, Math.ceil(total / limit));
  const points: Vector3[] = [];
  for (const mesh of meshes) {
    const position = mesh.geometry.attributes.position!;
    for (let i = 0; i < position.count; i += stride) {
      points.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
    }
  }
  return points;
}
